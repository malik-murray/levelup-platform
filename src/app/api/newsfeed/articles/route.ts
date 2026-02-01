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
        
        // Auto-fetch if table is empty or stale
        if (rawArticleCount === 0) {
            // Check total articles in table (not filtered by date)
            const { count: totalCount } = await supabase
                .from('newsfeed_articles')
                .select('*', { count: 'exact', head: true });
            
            console.log(`⚠️  DIAGNOSTIC: No articles in date range. Total articles in database: ${totalCount || 0}`);
            
            // If table is empty or very stale, trigger auto-fetch
            if (totalCount === 0 || (totalCount || 0) < 10) {
                console.log('🔄 Auto-fetching articles from RSS feeds...');
                
                try {
                    // Import dynamically to avoid circular dependencies
                    const { ingestArticlesFromSources } = await import('@/lib/newsfeed/articleIngestion');
                    
                    // Fetch from selected sources if available, otherwise all active sources
                    const fetchSourceIds = selectedSourceIds.length > 0 ? selectedSourceIds : undefined;
                    const fetchResult = await ingestArticlesFromSources(fetchSourceIds);
                    
                    console.log('✅ Auto-fetch complete:', {
                        sourcesProcessed: fetchResult.sourcesProcessed,
                        articlesFetched: fetchResult.totalArticlesFetched,
                        articlesInserted: fetchResult.totalArticlesInserted,
                    });
                    
                    // Re-query articles after fetch
                    const refreshResult = await executeQuery();
                    
                    if (!refreshResult.error && refreshResult.data) {
                        articlesData = refreshResult.data;
                        const newCount = refreshResult.data.length || 0;
                        console.log(`✅ Refreshed: Found ${newCount} articles after auto-fetch`);
                    } else if (refreshResult.error) {
                        console.error('Error re-querying after fetch:', refreshResult.error);
                    }
                } catch (fetchError) {
                    console.error('❌ Auto-fetch failed:', fetchError);
                    // Continue with empty results rather than failing the request
                }
            } else {
                console.log(`⚠️  DIAGNOSTIC: ${totalCount} articles exist but none in date range ${startDate.toISOString()} to ${endDate.toISOString()}`);
            }
        }

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
                    if (!articleTopics.includes(topicIdFilter)) {
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

