import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
        const filter = searchParams.get('filter') || 'feed'; // feed, saved, archived
        const sourceIdFilter = searchParams.get('sourceId');
        const topicIdFilter = searchParams.get('topicId');
        let expandedTopicFilterIds: string[] | null = null;

        // Get user preferences
        const { data: preferences, error: prefError } = await supabase
            .from('newsfeed_user_preferences')
            .select('selected_source_ids, selected_topic_ids')
            .eq('user_id', user.id)
            .single();

        if (prefError && prefError.code !== 'PGRST116') {
            throw prefError;
        }

        const selectedSourceIds = preferences?.selected_source_ids || [];
        const selectedTopicIds = preferences?.selected_topic_ids || [];

        // Expand topic filter aliases so related federal categories remain discoverable.
        // Example: "federal_workforce" and "fed_gov" should be treated as a shared filter group.
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

        // Log preferences for debugging
        console.log('User preferences:', {
            userId: user.id,
            selectedSourceIds: selectedSourceIds.length,
            selectedTopicIds: selectedTopicIds.length,
            sourceIds: selectedSourceIds,
            topicIds: selectedTopicIds,
        });

        // Build date range - use last 36 hours instead of strict midnight boundaries
        // This prevents timezone issues and ensures we catch recent articles
        let startDate: Date;
        let endDate: Date;

        if (dateParam) {
            const targetDate = new Date(dateParam);
            // For a specific date, show articles from 36 hours before to 12 hours after
            // This gives a 48-hour window centered on the selected date
            endDate = new Date(targetDate);
            endDate.setHours(12, 0, 0, 0); // End at noon of selected date
            startDate = new Date(endDate);
            startDate.setHours(startDate.getHours() - 36); // 36 hours before
        } else {
            // Default to last 36 hours from now
            endDate = new Date();
            startDate = new Date(endDate);
            startDate.setHours(startDate.getHours() - 36);
        }

        console.log('Date range:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            dateParam,
            filter,
        });

        // If neither sources nor topics are selected, return empty array
        if (selectedSourceIds.length === 0 && selectedTopicIds.length === 0) {
            console.log('No sources or topics selected - returning empty array');
            return NextResponse.json({ articles: [] });
        }

        // Helper function to build and execute the query
        const executeQuery = async () => {
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

        // Apply source filters
        if (sourceIdFilter) {
            // Client-side filter override
            query = query.eq('source_id', sourceIdFilter);
        } else if (selectedSourceIds.length > 0) {
            // User preferences filter
            query = query.in('source_id', selectedSourceIds);
        }

            return await query;
        };

        let { data: articlesData, error } = await executeQuery();

        if (error) {
            console.error('Error fetching articles from database:', error);
            throw error;
        }

        const rawArticleCount = articlesData?.length || 0;
        console.log(`Raw articles fetched from database: ${rawArticleCount}`);
        
        // Check how many articles have no topics
        const articlesWithoutTopics = articlesData?.filter((a: any) => 
            !a.topic_ids || (Array.isArray(a.topic_ids) && a.topic_ids.length === 0)
        ) || [];
        
        // If many articles lack topics, trigger topic update in background
        if (articlesWithoutTopics.length > 0 && articlesWithoutTopics.length > rawArticleCount * 0.5) {
            console.log(`⚠️  ${articlesWithoutTopics.length} articles without topics - triggering background update`);
            // Trigger update in background (don't wait)
            fetch(`${request.url.split('/api')[0]}/api/newsfeed/update-topics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            }).catch(err => console.error('Background topic update failed:', err));
        }
        
        // Ingestion is intentionally decoupled from this read path for fast response times.

        // Filter by topics/sources using OR logic
        // Article matches if:
        // - It's from a selected source OR
        // - It matches a selected topic
        let filteredArticles = articlesData || [];

        if (filteredArticles.length > 0) {
            const beforeFilterCount = filteredArticles.length;
            
            filteredArticles = filteredArticles.filter((article: any) => {
                const articleSourceId = article.source_id;
                const articleTopics = article.topic_ids || [];
                
                // PRIORITY 1: Client-side filters (from UI dropdowns) take precedence
                // If topic filter is set, article MUST match that topic
                if (topicIdFilter) {
                    const allowedTopicIds = expandedTopicFilterIds || [topicIdFilter];
                    if (!allowedTopicIds.some((topicId: string) => articleTopics.includes(topicId))) {
                        return false; // Reject if doesn't match topic filter
                    }
                }
                
                // If source filter is set, article MUST match that source
                if (sourceIdFilter) {
                    if (articleSourceId !== sourceIdFilter) {
                        return false; // Reject if doesn't match source filter
                    }
                }
                
                // PRIORITY 2: User preferences (if no client-side filters)
                // Only apply user preference filtering if no client-side filters are set
                if (!topicIdFilter && !sourceIdFilter) {
                    // Match if article is from a selected source
                    const matchesSource = selectedSourceIds.length === 0 || selectedSourceIds.includes(articleSourceId);
                    
                    // Match if article has at least one selected topic
                    const matchesTopic = selectedTopicIds.length === 0 || 
                        selectedTopicIds.some((topicId: string) => articleTopics.includes(topicId));
                    
                    // OR logic: match if source OR topic matches
                    // If no sources selected, only check topics
                    // If no topics selected, only check sources
                    // If both selected, match if either matches
                    if (selectedSourceIds.length === 0) {
                        return matchesTopic;
                    } else if (selectedTopicIds.length === 0) {
                        return matchesSource;
                    } else {
                        return matchesSource || matchesTopic;
                    }
                }
                
                // If client-side filters are set and article passed them, include it
                return true;
            });
            
            const afterFilterCount = filteredArticles.length;
            console.log(`Articles after source/topic filtering: ${beforeFilterCount} → ${afterFilterCount}`);
        } else {
            console.log('No articles in date range - database may be empty or date range too narrow');
        }

        // Get article IDs for fetching user actions
        const articleIds = filteredArticles.map((a: any) => a.id);

        // Fetch user actions for these articles
        let userActionsMap: Record<string, any> = {};
        if (articleIds.length > 0) {
            const { data: actions } = await supabase
                .from('newsfeed_user_article_actions')
                .select('*')
                .eq('user_id', user.id)
                .in('article_id', articleIds);

            if (actions) {
                actions.forEach((action) => {
                    userActionsMap[action.article_id] = action;
                });
            }
        }

        // Apply saved/archived filter
        const beforeActionFilterCount = filteredArticles.length;
        if (filter === 'saved') {
            filteredArticles = filteredArticles.filter((article: any) => {
                const action = userActionsMap[article.id];
                return action && action.is_saved === true;
            });
        } else if (filter === 'archived') {
            filteredArticles = filteredArticles.filter((article: any) => {
                const action = userActionsMap[article.id];
                return action && action.is_archived === true;
            });
        } else {
            // feed: exclude archived items
            filteredArticles = filteredArticles.filter((article: any) => {
                const action = userActionsMap[article.id];
                return !action || action.is_archived !== true;
            });
        }
        const afterActionFilterCount = filteredArticles.length;
        console.log(`Articles after action filter (${filter}): ${beforeActionFilterCount} → ${afterActionFilterCount}`);

        const articles = filteredArticles;
        console.log(`Final articles to return: ${articles.length}`);

        // Transform data for frontend
        const transformedArticles = (articles || []).map((article: any) => {
            const action = userActionsMap[article.id] || {};
            const summary = article.newsfeed_article_summaries?.[0];
            const source = article.newsfeed_sources;

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
                summary: summary ? {
                    paragraphs_1: summary.summary_1_paragraph,
                    paragraphs_2: summary.summary_2_paragraphs,
                    paragraphs_3: summary.summary_3_paragraphs,
                    paragraphs_4: summary.summary_4_paragraphs,
                    paragraphs_5: summary.summary_5_paragraphs,
                    why_it_matters: summary.why_it_matters,
                } : null,
                user_action: {
                    is_saved: action.is_saved || false,
                    is_archived: action.is_archived || false,
                    preferred_summary_length: action.preferred_summary_length || 1,
                },
            };
        });

        // Apply intelligence-layer ranking if analysis exists.
        if (transformedArticles.length > 0) {
            const transformedIds = transformedArticles.map((article: any) => article.id);
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

            transformedArticles.sort((a: any, b: any) => {
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

        console.log('Returning articles to client:', {
            count: transformedArticles.length,
            dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
            filter,
            selectedSources: selectedSourceIds.length,
            selectedTopics: selectedTopicIds.length,
        });

        return NextResponse.json({ articles: transformedArticles });
    } catch (error) {
        console.error('Error fetching articles:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch articles' },
            { status: 500 }
        );
    }
}

