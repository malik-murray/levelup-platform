/**
 * Article Ingestion Service
 * Fetches articles from RSS feeds and stores them in the database
 */

import { createClient } from '@supabase/supabase-js';
import { fetchRSSFeed, normalizeUrl, RSSArticle } from './rssFetcher';
import { getFallbackTopicNameForSourceCategory, matchArticleToTopics } from './topicMatcher';
import { APPROVED_SOURCE_REGISTRY } from './sourceRegistry';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use service role key for ingestion (bypasses RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface IngestionResult {
    sourcesProcessed: number;
    totalArticlesFetched: number;
    totalArticlesInserted: number;
    exactTopicAssignments: number;
    fallbackTopicAssignments: number;
    failedBatches: number;
    inactiveFeeds: number;
    errors: string[];
}

type InsertStats = {
    inserted: number;
    exactTopicAssignments: number;
    fallbackTopicAssignments: number;
    failedBatches: number;
};

type SourceRecord = {
    id: string;
    name: string;
    display_name: string;
    domain: string | null;
    rss_feed_url: string | null;
    rss_url: string | null;
    category: string | null;
    is_active: boolean;
    feed_status?: string | null;
    failure_count?: number | null;
};

type FeedFailureCode = '404' | '403' | 'ENOTFOUND' | 'TIMEOUT' | 'UNKNOWN';

type FeedFailure = {
    code: FeedFailureCode;
    statusCode: number | null;
    message: string;
    permanent: boolean;
};

function classifyFeedFailure(error: unknown): FeedFailure {
    const statusCode = (error as { statusCode?: number } | null)?.statusCode ?? null;
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();

    if (statusCode === 404 || lowered.includes('status code 404')) return { code: '404', statusCode: 404, message, permanent: true };
    if (statusCode === 403 || lowered.includes('status code 403')) return { code: '403', statusCode: 403, message, permanent: true };
    if (lowered.includes('enotfound') || lowered.includes('invalid dns')) return { code: 'ENOTFOUND', statusCode, message, permanent: true };
    if (lowered.includes('timed out') || lowered.includes('etimedout')) return { code: 'TIMEOUT', statusCode, message, permanent: false };
    return { code: 'UNKNOWN', statusCode, message, permanent: false };
}

async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 2,
    baseDelayMs = 600,
    shouldRetry?: (error: unknown) => boolean,
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const canRetry = shouldRetry ? shouldRetry(error) : true;
            if (attempt < retries && canRetry) {
                const waitMs = baseDelayMs * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            } else {
                break;
            }
        }
    }
    throw lastError;
}

async function updateSourceStatus(
    sourceId: string,
    input: {
        lastError: string | null;
        lastErrorCode?: string | null;
        feedStatus?: string;
        isActive?: boolean;
        incrementFailureCount?: boolean;
        resetFailureCount?: boolean;
    }
) {
    const payload: Record<string, unknown> = {
        last_error: input.lastError,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    if (typeof input.isActive === 'boolean') {
        payload.is_active = input.isActive;
    }
    if (typeof input.feedStatus === 'string') {
        payload.feed_status = input.feedStatus;
    }
    if (input.lastErrorCode !== undefined) {
        payload.last_error_code = input.lastErrorCode;
    }
    if (input.resetFailureCount) {
        payload.failure_count = 0;
    } else if (input.incrementFailureCount) {
        const { data } = await supabase
            .from('newsfeed_sources')
            .select('failure_count')
            .eq('id', sourceId)
            .single();
        payload.failure_count = (data?.failure_count || 0) + 1;
    }
    await supabase.from('newsfeed_sources').update(payload).eq('id', sourceId);
}

async function markSourceFromFailure(source: SourceRecord, failure: FeedFailure) {
    const feedStatus =
        failure.code === '404'
            ? 'not_found'
            : failure.code === '403'
                ? 'blocked'
                : failure.code === 'ENOTFOUND'
                    ? 'invalid_dns'
                    : failure.code === 'TIMEOUT'
                        ? 'timeout'
                        : 'error';
    const shouldDeactivate = failure.code === '404' || failure.code === '403' || failure.code === 'ENOTFOUND';
    await updateSourceStatus(source.id, {
        lastError: failure.message,
        lastErrorCode: failure.code,
        feedStatus,
        isActive: shouldDeactivate ? false : source.is_active,
        incrementFailureCount: true,
    });
}

/**
 * Fetch and ingest articles from selected sources
 */
export async function ingestArticlesFromSources(
    sourceIds?: string[]
): Promise<IngestionResult> {
    const result: IngestionResult = {
        sourcesProcessed: 0,
        totalArticlesFetched: 0,
        totalArticlesInserted: 0,
        exactTopicAssignments: 0,
        fallbackTopicAssignments: 0,
        failedBatches: 0,
        inactiveFeeds: 0,
        errors: [],
    };

    try {
        // Get all available topics for matching
        const { data: topics, error: topicsError } = await supabase
            .from('newsfeed_topics')
            .select('id, name, display_name')
            .eq('is_active', true);

        if (topicsError) {
            console.error('Error fetching topics:', topicsError);
        }

        const availableTopics = topics || [];

        const approvedSourceNames = new Set(APPROVED_SOURCE_REGISTRY.map((entry) => entry.name));

        // Get sources with RSS feed URLs from curated registry only.
        let query = supabase
            .from('newsfeed_sources')
            .select('id, name, display_name, domain, rss_feed_url, rss_url, category, is_active, feed_status, failure_count')
            .eq('is_active', true)
            .in('name', Array.from(approvedSourceNames));

        if (sourceIds && sourceIds.length > 0) {
            query = query.in('id', sourceIds);
        }

        const { data: sources, error: sourcesError } = await query;

        if (sourcesError) {
            throw sourcesError;
        }

        if (!sources || sources.length === 0) {
            console.log('No sources with RSS feeds found');
            return result;
        }

        console.log(`Processing ${sources.length} sources...`);

        // Process each source
        for (const source of (sources || []) as SourceRecord[]) {
            const feedUrl = source.rss_url || source.rss_feed_url;
            if (!feedUrl) {
                await updateSourceStatus(source.id, {
                    lastError: 'No active RSS URL configured',
                    lastErrorCode: 'NO_RSS_URL',
                    feedStatus: 'no_feed',
                    isActive: false,
                    incrementFailureCount: true,
                });
                result.inactiveFeeds += 1;
                continue;
            }

            try {
                // Fetch articles from RSS feed
                const articles = await withRetry(
                    () => fetchRSSFeed(feedUrl),
                    2,
                    700,
                    (error) => !classifyFeedFailure(error).permanent
                );
                result.totalArticlesFetched += articles.length;

                if (articles.length === 0) {
                    console.log(`No articles found for ${source.display_name}`);
                    await updateSourceStatus(source.id, {
                        lastError: null,
                        lastErrorCode: null,
                        feedStatus: 'active',
                        resetFailureCount: true,
                    });
                    continue;
                }

                // Insert/upsert articles with topic matching
                const insertStats = await insertArticles(
                    articles,
                    {
                        sourceId: source.id,
                        sourceDisplayName: source.display_name,
                        sourceCategory: source.category,
                    },
                    availableTopics
                );
                result.totalArticlesInserted += insertStats.inserted;
                result.exactTopicAssignments += insertStats.exactTopicAssignments;
                result.fallbackTopicAssignments += insertStats.fallbackTopicAssignments;
                result.failedBatches += insertStats.failedBatches;
                result.sourcesProcessed++;
                await updateSourceStatus(source.id, {
                    lastError: null,
                    lastErrorCode: null,
                    feedStatus: 'active',
                    resetFailureCount: true,
                });

                console.log(
                    `✓ ${source.display_name}: fetched=${articles.length}, inserted=${insertStats.inserted}, exact_topics=${insertStats.exactTopicAssignments}, fallback_topics=${insertStats.fallbackTopicAssignments}, failed_batches=${insertStats.failedBatches}`
                );
            } catch (error) {
                const failure = classifyFeedFailure(error);
                const errorMsg = `Error processing ${source.display_name}: ${failure.message}`;
                result.errors.push(errorMsg);
                await markSourceFromFailure(source, failure);
                if (failure.permanent) {
                    result.inactiveFeeds += 1;
                }
                console.warn(`${source.display_name} feed failure [${failure.code}]`);
            }
        }

        console.log('Ingestion complete:', {
            sourcesProcessed: result.sourcesProcessed,
            totalArticlesFetched: result.totalArticlesFetched,
            totalArticlesInserted: result.totalArticlesInserted,
            exactTopicAssignments: result.exactTopicAssignments,
            fallbackTopicAssignments: result.fallbackTopicAssignments,
            failedBatches: result.failedBatches,
            inactiveFeeds: result.inactiveFeeds,
            errors: result.errors.length,
        });

        return result;
    } catch (error) {
        const errorMsg = `Ingestion failed: ${
            error instanceof Error ? error.message : 'Unknown error'
        }`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        return result;
    }
}

/**
 * Insert articles into database (with deduplication by URL)
 */
async function insertArticles(
    articles: RSSArticle[],
    source: {
        sourceId: string;
        sourceDisplayName: string;
        sourceCategory: string | null;
    },
    availableTopics: Array<{ id: string; name: string; display_name: string }>
): Promise<InsertStats> {
    const empty: InsertStats = {
        inserted: 0,
        exactTopicAssignments: 0,
        fallbackTopicAssignments: 0,
        failedBatches: 0,
    };
    if (articles.length === 0) {
        return empty;
    }

    const topicNameToId = new Map(availableTopics.map((topic) => [topic.name, topic.id]));
    const fallbackTopicName = getFallbackTopicNameForSourceCategory(source.sourceCategory);
    const fallbackTopicId = topicNameToId.get(fallbackTopicName);

    // Normalize URLs and prepare for insertion
    const mappedArticles = articles.map((article) => {
        const normalizedUrl = normalizeUrl(article.url);
        
        // Clean description - remove HTML tags and limit length
        let description = article.description || '';
        if (description) {
            // Remove HTML tags
            description = description.replace(/<[^>]*>/g, '').trim();
            // Limit to 1000 characters
            if (description.length > 1000) {
                description = description.substring(0, 997) + '...';
            }
        }

        // Match article to topics based on title and description
        const matchedTopicIds = matchArticleToTopics(
            article.title,
            description || null,
            availableTopics
        );

        let topicIds = matchedTopicIds;
        let usedFallback = false;
        if (topicIds.length === 0 && fallbackTopicId) {
            topicIds = [fallbackTopicId];
            usedFallback = true;
        } else if (topicIds.length === 0 && !fallbackTopicId) {
            console.warn(
                `Fallback topic assignment failed for source "${source.sourceDisplayName}" article "${article.title.substring(0, 80)}"`
            );
        }

        return {
            source_id: source.sourceId,
            title: article.title.substring(0, 500), // Limit title length
            url: normalizedUrl,
            publish_time: article.publishTime.toISOString(),
            description: description || null,
            image_url: article.imageUrl || null,
            raw_json: article.rawData || null,
            topic_ids: topicIds,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _usedFallback: usedFallback,
            _hadExact: matchedTopicIds.length > 0,
        };
    });

    // Insert articles (upsert on URL conflict)
    const stats: InsertStats = {
        inserted: 0,
        exactTopicAssignments: mappedArticles.filter((a) => a._hadExact).length,
        fallbackTopicAssignments: mappedArticles.filter((a) => a._usedFallback).length,
        failedBatches: 0,
    };
    const batchSize = 25;

    for (let i = 0; i < mappedArticles.length; i += batchSize) {
        const batch = mappedArticles.slice(i, i + batchSize);
        const payload = batch.map((row) => ({
            source_id: row.source_id,
            title: row.title,
            url: row.url,
            publish_time: row.publish_time,
            description: row.description,
            image_url: row.image_url,
            raw_json: row.raw_json,
            topic_ids: row.topic_ids,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));

        try {
            const response = await withRetry(
                async () =>
                    supabase
                        .from('newsfeed_articles')
                        .upsert(payload, {
                            onConflict: 'url',
                            ignoreDuplicates: false,
                        })
                        .select('id'),
                2,
                500
            );
            const { data, error, status, statusText } = response;

            if (error) {
                throw { error, status, statusText };
            }

            stats.inserted += data?.length || 0;
        } catch (error) {
            stats.failedBatches += 1;
            const batchError = error as {
                error?: { message?: string; details?: string; hint?: string; code?: string };
                status?: number;
                statusText?: string;
            };
            console.error(`Insert batch failed for source "${source.sourceDisplayName}" [${i}-${i + batch.length - 1}]`, {
                message: batchError.error?.message || 'Unknown insert error',
                details: batchError.error?.details || null,
                hint: batchError.error?.hint || null,
                code: batchError.error?.code || null,
                status: batchError.status ?? null,
                statusText: batchError.statusText ?? null,
                samplePayload: payload.slice(0, 2).map((row) => ({
                    source_id: row.source_id,
                    title: row.title,
                    url: row.url,
                    publish_time: row.publish_time,
                    topic_ids: row.topic_ids,
                })),
            });

            for (const articlePayload of payload) {
                try {
                    const singleRes = await supabase
                        .from('newsfeed_articles')
                        .upsert([articlePayload], {
                            onConflict: 'url',
                            ignoreDuplicates: false,
                        })
                        .select('id');
                    if (singleRes.error) {
                        console.error('Single article insert failed', {
                            message: singleRes.error.message,
                            details: singleRes.error.details,
                            hint: singleRes.error.hint,
                            code: singleRes.error.code,
                            status: singleRes.status ?? null,
                            statusText: singleRes.statusText ?? null,
                            payload: {
                                source_id: articlePayload.source_id,
                                title: articlePayload.title,
                                url: articlePayload.url,
                                publish_time: articlePayload.publish_time,
                                topic_ids: articlePayload.topic_ids,
                            },
                        });
                        continue;
                    }
                    stats.inserted += singleRes.data?.length || 0;
                } catch (singleError) {
                    console.error('Single article insert exception', {
                        message: singleError instanceof Error ? singleError.message : String(singleError),
                        payload: {
                            source_id: articlePayload.source_id,
                            title: articlePayload.title,
                            url: articlePayload.url,
                        },
                    });
                }
            }
            continue;
        }
    }

    return stats;
}

/**
 * Check if articles need refreshing (no articles in last 36 hours)
 */
export async function needsRefresh(): Promise<boolean> {
    const thirtySixHoursAgo = new Date();
    thirtySixHoursAgo.setHours(thirtySixHoursAgo.getHours() - 36);

    const { count, error } = await supabase
        .from('newsfeed_articles')
        .select('*', { count: 'exact', head: true })
        .gte('publish_time', thirtySixHoursAgo.toISOString());

    if (error) {
        console.error('Error checking if refresh needed:', error);
        return true; // Default to refreshing on error
    }

    return (count || 0) === 0;
}
