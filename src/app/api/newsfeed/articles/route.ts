import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildArticleDateRange, buildFallbackDateRange } from '@/lib/newsfeed/dateRange';
import { triggerNewsfeedIngestionIfStale } from '@/lib/newsfeed/runIngestionIfStale';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type SourceRef = {
    id: string;
    name: string;
    display_name: string;
};

type ArticleSummaryRef = {
    summary_1_paragraph: string | null;
    summary_2_paragraphs: string | null;
    summary_3_paragraphs: string | null;
    summary_4_paragraphs: string | null;
    summary_5_paragraphs: string | null;
    why_it_matters: string | null;
};

type RawArticle = {
    id: string;
    title: string;
    url: string;
    publish_time: string;
    description: string | null;
    image_url: string | null;
    topic_ids: string[];
    source_id: string;
    newsfeed_sources: SourceRef | SourceRef[] | null;
    newsfeed_article_summaries: ArticleSummaryRef | ArticleSummaryRef[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return value ?? null;
}

/**
 * GET /api/newsfeed/articles
 * Get articles for user's feed based on preferences
 * Query params: date (YYYY-MM-DD), filter (feed|saved|archived)
 */
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookieStore.set(name, value, options);
                    } catch (error) {
                        // Ignore cookie set errors in API routes
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookieStore.set(name, '', { ...options, maxAge: 0 });
                    } catch (error) {
                        // Ignore cookie remove errors
                    }
                },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        const filter = searchParams.get('filter') || 'feed';
        const sourceIdFilter = searchParams.get('sourceId');
        const topicIdFilter = searchParams.get('topicId');
        let expandedTopicFilterIds: string[] | null = null;

        const { data: preferences, error: prefError } = await supabase
            .from('newsfeed_user_preferences')
            .select('selected_source_ids, selected_topic_ids')
            .eq('user_id', user.id)
            .single();

        if (prefError && prefError.code !== 'PGRST116') {
            throw prefError;
        }

        const selectedSourceIds: string[] = Array.isArray(preferences?.selected_source_ids)
            ? preferences.selected_source_ids
            : [];
        const selectedTopicIds: string[] = Array.isArray(preferences?.selected_topic_ids)
            ? preferences.selected_topic_ids
            : [];

        if (topicIdFilter) {
            const { data: selectedTopic } = await supabase
                .from('newsfeed_topics')
                .select('id, name')
                .eq('id', topicIdFilter)
                .single();

            if (selectedTopic?.name === 'federal_workforce' || selectedTopic?.name === 'fed_gov') {
                const { data: federalAliases } = await supabase
                    .from('newsfeed_topics')
                    .select('id')
                    .in('name', ['federal_workforce', 'fed_gov']);
                expandedTopicFilterIds = (federalAliases || []).map((topic) => topic.id);
            } else {
                expandedTopicFilterIds = [topicIdFilter];
            }
        }

        if (selectedSourceIds.length === 0 && selectedTopicIds.length === 0) {
            return NextResponse.json({ articles: [] });
        }

        if (filter === 'feed') {
            triggerNewsfeedIngestionIfStale({
                sourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
            });
        }

        const primaryRange = buildArticleDateRange(dateParam);
        const canUseFallback =
            primaryRange.isToday &&
            filter === 'feed' &&
            !sourceIdFilter &&
            !topicIdFilter;

        const loadArticlesForRange = async (startDate: Date, endDate: Date) => {
            let query = supabase
                .from('newsfeed_articles')
                .select(`
                    id,
                    title,
                    url,
                    publish_time,
                    description,
                    image_url,
                    topic_ids,
                    created_at,
                    source_id,
                    newsfeed_sources(id, name, display_name),
                    newsfeed_article_summaries(id, summary_1_paragraph, summary_2_paragraphs, summary_3_paragraphs, summary_4_paragraphs, summary_5_paragraphs, why_it_matters)
                `)
                .gte('publish_time', startDate.toISOString())
                .lte('publish_time', endDate.toISOString())
                .order('publish_time', { ascending: false });

            if (sourceIdFilter) {
                query = query.eq('source_id', sourceIdFilter);
            } else if (selectedSourceIds.length > 0) {
                query = query.in('source_id', selectedSourceIds);
            }

            const { data, error } = await query;
            if (error) {
                throw error;
            }

            let filteredArticles = (data || []) as RawArticle[];

            if (filteredArticles.length > 0) {
                filteredArticles = filteredArticles.filter((article) => {
                    const articleSourceId = article.source_id;
                    const articleTopics = article.topic_ids || [];

                    if (topicIdFilter) {
                        const allowedTopicIds = expandedTopicFilterIds || [topicIdFilter];
                        if (!allowedTopicIds.some((topicId) => articleTopics.includes(topicId))) {
                            return false;
                        }
                    }

                    if (sourceIdFilter && articleSourceId !== sourceIdFilter) {
                        return false;
                    }

                    if (!topicIdFilter && !sourceIdFilter) {
                        const matchesSource =
                            selectedSourceIds.length === 0 || selectedSourceIds.includes(articleSourceId);
                        const matchesTopic =
                            selectedTopicIds.length === 0 ||
                            selectedTopicIds.some((topicId) => articleTopics.includes(topicId));

                        if (selectedSourceIds.length === 0) {
                            return matchesTopic;
                        }
                        if (selectedTopicIds.length === 0) {
                            return matchesSource;
                        }
                        return matchesSource || matchesTopic;
                    }

                    return true;
                });
            }

            const articleIds = filteredArticles.map((article) => article.id);
            const userActionsMap: Record<string, any> = {};

            if (articleIds.length > 0) {
                const { data: actions } = await supabase
                    .from('newsfeed_user_article_actions')
                    .select('*')
                    .eq('user_id', user.id)
                    .in('article_id', articleIds);

                actions?.forEach((action) => {
                    userActionsMap[action.article_id] = action;
                });
            }

            if (filter === 'saved') {
                filteredArticles = filteredArticles.filter((article) => {
                    const action = userActionsMap[article.id];
                    return action && action.is_saved === true;
                });
            } else if (filter === 'archived') {
                filteredArticles = filteredArticles.filter((article) => {
                    const action = userActionsMap[article.id];
                    return action && action.is_archived === true;
                });
            } else {
                filteredArticles = filteredArticles.filter((article) => {
                    const action = userActionsMap[article.id];
                    return !action || action.is_archived !== true;
                });
            }

            return filteredArticles.map((article) => {
                const action = userActionsMap[article.id] || {};
                const summary = firstRelation(article.newsfeed_article_summaries);
                const source = firstRelation(article.newsfeed_sources);

                return {
                    id: article.id,
                    title: article.title,
                    url: article.url,
                    publish_time: article.publish_time,
                    description: article.description || null,
                    image_url: article.image_url || null,
                    topic_ids: article.topic_ids,
                    source: {
                        id: source?.id,
                        name: source?.name,
                        display_name: source?.display_name,
                    },
                    summary: summary
                        ? {
                              paragraphs_1: summary.summary_1_paragraph,
                              paragraphs_2: summary.summary_2_paragraphs,
                              paragraphs_3: summary.summary_3_paragraphs,
                              paragraphs_4: summary.summary_4_paragraphs,
                              paragraphs_5: summary.summary_5_paragraphs,
                              why_it_matters: summary.why_it_matters,
                          }
                        : null,
                    user_action: {
                        is_saved: action.is_saved || false,
                        is_archived: action.is_archived || false,
                        preferred_summary_length: action.preferred_summary_length || 1,
                    },
                };
            });
        };

        let usedFallback = false;
        let activeRange = primaryRange;
        let transformedArticles = await loadArticlesForRange(activeRange.startDate, activeRange.endDate);

        if (transformedArticles.length === 0 && canUseFallback) {
            activeRange = buildFallbackDateRange();
            transformedArticles = await loadArticlesForRange(activeRange.startDate, activeRange.endDate);
            usedFallback = transformedArticles.length > 0;
        }

        if (transformedArticles.length > 0) {
            const transformedIds = transformedArticles.map((article) => article.id);
            const { data: rankingRows, error: rankingError } = await supabase
                .from('newsfeed_top_story_rankings')
                .select('article_id, rank_position, final_score')
                .in('article_id', transformedIds);

            if (rankingError) {
                console.warn('Ranking table unavailable, using publish_time ordering:', rankingError.message);
            }

            const rankingMap = new Map(
                (rankingRows || []).map((row) => [
                    row.article_id,
                    {
                        rank_position: row.rank_position ?? Number.MAX_SAFE_INTEGER,
                        final_score: row.final_score ?? 0,
                    },
                ])
            );

            transformedArticles.sort((a, b) => {
                const rankA = rankingMap.get(a.id);
                const rankB = rankingMap.get(b.id);
                if (rankA && rankB) {
                    if (rankA.rank_position !== rankB.rank_position) {
                        return rankA.rank_position - rankB.rank_position;
                    }
                    return rankB.final_score - rankA.final_score;
                }
                if (rankA) return -1;
                if (rankB) return 1;
                return new Date(b.publish_time).getTime() - new Date(a.publish_time).getTime();
            });
        }

        return NextResponse.json({
            articles: transformedArticles,
            meta: {
                usedFallback,
                dateRange: {
                    start: activeRange.startDate.toISOString(),
                    end: activeRange.endDate.toISOString(),
                },
            },
        });
    } catch (error) {
        console.error('Error fetching articles:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch articles' },
            { status: 500 }
        );
    }
}
