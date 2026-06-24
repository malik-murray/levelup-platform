import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildArticleDateRange, buildFallbackDateRange } from '@/lib/newsfeed/dateRange';
import { triggerNewsfeedIngestionIfStale } from '@/lib/newsfeed/runIngestionIfStale';
import { getMainstreamGlobalSourceNames } from '@/lib/newsfeed/sourceRegistry';
import { rankArticlesForBriefing } from '@/lib/newsfeed/topStoriesRanking';
import { buildArticleSummaryView } from '@/lib/newsfeed/articlePresentation';
import { hasUserFeedContext, normalizeUserFeedContext } from '@/lib/newsfeed/userFeedContext';

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

type ArticleAnalysisRef = {
    why_it_matters: string | null;
    user_action: string | null;
    final_score: number | null;
    importance_score: number | null;
    urgency_score: number | null;
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
    newsfeed_article_analysis: ArticleAnalysisRef | ArticleAnalysisRef[] | null;
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
 * Query params: date (YYYY-MM-DD), filter (feed|saved|archived), scope (personal|global)
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
        const scope = searchParams.get('scope') || 'personal';
        const sourceIdFilter = searchParams.get('sourceId');
        const topicIdFilter = searchParams.get('topicId');
        let expandedTopicFilterIds: string[] | null = null;
        let globalSourceIds: string[] = [];

        if (scope === 'global') {
            const { data: globalSources, error: globalSourcesError } = await supabase
                .from('newsfeed_sources')
                .select('id')
                .in('name', getMainstreamGlobalSourceNames())
                .eq('is_active', true);

            if (globalSourcesError) {
                throw globalSourcesError;
            }

            globalSourceIds = (globalSources || []).map((source) => source.id);
        }

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

        const { data: contextRow } = await supabase
            .from('newsfeed_user_context')
            .select('role_job_context, interests, goals')
            .eq('user_id', user.id)
            .maybeSingle();
        const userFeedContext = normalizeUserFeedContext(contextRow);

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

        if (scope !== 'global' && selectedSourceIds.length === 0 && selectedTopicIds.length === 0) {
            return NextResponse.json({ articles: [] });
        }

        if (filter === 'feed') {
            if (scope === 'global' && globalSourceIds.length > 0) {
                const primaryRange = buildArticleDateRange(dateParam);
                triggerNewsfeedIngestionIfStale({
                    sourceIds: globalSourceIds,
                    lookbackHours: 24,
                    force: primaryRange.isToday,
                });
            } else {
                triggerNewsfeedIngestionIfStale({
                    sourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
                    userFeedContext: hasUserFeedContext(userFeedContext) ? userFeedContext : null,
                });
            }
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
                    newsfeed_article_summaries(id, summary_1_paragraph, summary_2_paragraphs, summary_3_paragraphs, summary_4_paragraphs, summary_5_paragraphs, why_it_matters),
                    newsfeed_article_analysis(why_it_matters, user_action, final_score, importance_score, urgency_score)
                `)
                .gte('publish_time', startDate.toISOString())
                .lte('publish_time', endDate.toISOString())
                .order('publish_time', { ascending: false });

            if (sourceIdFilter) {
                query = query.eq('source_id', sourceIdFilter);
            } else if (scope === 'global' && globalSourceIds.length > 0) {
                query = query.in('source_id', globalSourceIds);
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
                        if (scope === 'global') {
                            return true;
                        }

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
                const storedSummary = firstRelation(article.newsfeed_article_summaries);
                const analysis = firstRelation(article.newsfeed_article_analysis);
                const source = firstRelation(article.newsfeed_sources);
                const summary = buildArticleSummaryView(storedSummary, analysis, article.description);

                return {
                    id: article.id,
                    title: article.title,
                    url: article.url,
                    publish_time: article.publish_time,
                    description: article.description || null,
                    image_url: article.image_url || null,
                    topic_ids: article.topic_ids,
                    source: {
                        id: source?.id ?? article.source_id,
                        name: source?.name ?? 'unknown',
                        display_name: source?.display_name ?? 'Unknown source',
                    },
                    summary,
                    analysis: analysis
                        ? {
                              final_score: analysis.final_score,
                              importance_score: analysis.importance_score,
                              urgency_score: analysis.urgency_score,
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
            const { data: topics } = await supabase.from('newsfeed_topics').select('id, name');
            const topicIdToName = new Map((topics || []).map((topic) => [topic.id, topic.name]));

            if (scope === 'global') {
                const { topStories } = rankArticlesForBriefing(transformedArticles, topicIdToName, {
                    topStoriesCount: 20,
                    maxPerSource: 2,
                });
                transformedArticles = topStories;
            } else {
                const { rankedArticles } = rankArticlesForBriefing(
                    transformedArticles,
                    topicIdToName,
                    { topStoriesCount: transformedArticles.length, maxPerSource: 3 },
                    userFeedContext,
                );
                transformedArticles = rankedArticles;
            }
        }

        return NextResponse.json({
            articles: transformedArticles,
            meta: {
                usedFallback,
                scope,
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
