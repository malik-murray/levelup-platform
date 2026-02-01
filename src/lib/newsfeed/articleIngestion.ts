/**
 * Article Ingestion Service
 * Fetches articles from RSS feeds and stores them in the database
 */

import { createClient } from '@supabase/supabase-js';
import { fetchRSSFeed, normalizeUrl, RSSArticle } from './rssFetcher';
import { matchArticleToTopics } from './topicMatcher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use service role key for ingestion (bypasses RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface IngestionResult {
    sourcesProcessed: number;
    totalArticlesFetched: number;
    totalArticlesInserted: number;
    errors: string[];
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

        // Get sources with RSS feed URLs
        let query = supabase
            .from('newsfeed_sources')
            .select('id, name, display_name, rss_feed_url')
            .eq('is_active', true)
            .not('rss_feed_url', 'is', null);

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
        for (const source of sources) {
            if (!source.rss_feed_url) {
                continue;
            }

            try {
                // Fetch articles from RSS feed
                const articles = await fetchRSSFeed(source.rss_feed_url);
                result.totalArticlesFetched += articles.length;

                if (articles.length === 0) {
                    console.log(`No articles found for ${source.display_name}`);
                    continue;
                }

                // Insert/upsert articles with topic matching
                const inserted = await insertArticles(articles, source.id, availableTopics);
                result.totalArticlesInserted += inserted;
                result.sourcesProcessed++;

                // Log topic assignment stats
                const articlesWithTopics = articles.filter((article, idx) => {
                    // Check if the article would have topics (we'll see this in the insert)
                    const matchedTopics = matchArticleToTopics(
                        article.title,
                        article.description || null,
                        availableTopics
                    );
                    return matchedTopics.length > 0;
                });

                console.log(
                    `✓ ${source.display_name}: ${articles.length} fetched, ${inserted} inserted, ${articlesWithTopics.length} with topics assigned`
                );
            } catch (error) {
                const errorMsg = `Error processing ${source.display_name}: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`;
                console.error(errorMsg, error);
                result.errors.push(errorMsg);
            }
        }

        console.log('Ingestion complete:', {
            sourcesProcessed: result.sourcesProcessed,
            totalArticlesFetched: result.totalArticlesFetched,
            totalArticlesInserted: result.totalArticlesInserted,
            errors: result.errors.length,
        });

        return result;
    } catch (error) {
        const errorMsg = `Ingestion failed: ${
            error instanceof Error ? error.message : 'Unknown error'
        }`;
        console.error(errorMsg, error);
        result.errors.push(errorMsg);
        return result;
    }
}

/**
 * Insert articles into database (with deduplication by URL)
 */
async function insertArticles(
    articles: RSSArticle[],
    sourceId: string,
    availableTopics: Array<{ id: string; name: string; display_name: string }>
): Promise<number> {
    if (articles.length === 0) {
        return 0;
    }

    // Normalize URLs and prepare for insertion
    const articlesToInsert = articles.map((article) => {
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

        // Log if no topics matched (for debugging)
        if (matchedTopicIds.length === 0) {
            console.log(`⚠️  No topics matched for: "${article.title.substring(0, 50)}..."`);
        }
        
        return {
            source_id: sourceId,
            title: article.title.substring(0, 500), // Limit title length
            url: normalizedUrl,
            publish_time: article.publishTime.toISOString(),
            description: description || null,
            image_url: article.imageUrl || null,
            raw_json: article.rawData || null,
            topic_ids: matchedTopicIds.length > 0 ? matchedTopicIds : [], // Auto-assigned based on keywords
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    });

    // Insert articles (upsert on URL conflict)
    let inserted = 0;
    const batchSize = 50;

    for (let i = 0; i < articlesToInsert.length; i += batchSize) {
        const batch = articlesToInsert.slice(i, i + batchSize);
        
        const { data, error } = await supabase
            .from('newsfeed_articles')
            .upsert(batch, {
                onConflict: 'url',
                ignoreDuplicates: false, // Update existing
            })
            .select('id');

        if (error) {
            // If it's a unique constraint violation, that's expected (duplicate URL)
            if (error.code === '23505') {
                // Count how many were actually new by checking which URLs exist
                const urls = batch.map((a) => a.url);
                const { count } = await supabase
                    .from('newsfeed_articles')
                    .select('id', { count: 'exact', head: true })
                    .in('url', urls);
                
                inserted += count || 0;
            } else {
                console.error('Error inserting articles batch:', error);
                throw error;
            }
        } else {
            inserted += data?.length || 0;
        }
    }

    return inserted;
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
