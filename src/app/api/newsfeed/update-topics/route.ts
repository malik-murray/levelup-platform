/**
 * POST /api/newsfeed/update-topics
 * Update topic assignments for existing articles based on keywords
 * Useful for backfilling topics on articles that were ingested before topic matching
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { matchArticleToTopics } from '@/lib/newsfeed/topicMatcher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set() {},
                remove() {},
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Use service role for bulk updates
        const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

        // Get all topics
        const { data: topics, error: topicsError } = await supabaseService
            .from('newsfeed_topics')
            .select('id, name, display_name')
            .eq('is_active', true);

        if (topicsError || !topics) {
            throw new Error('Failed to fetch topics');
        }

        // Get all articles (we'll update all to ensure they have topics)
        // This includes articles with empty/null topic_ids and also updates existing ones
        const { data: articles, error: articlesError } = await supabaseService
            .from('newsfeed_articles')
            .select('id, title, description, topic_ids')
            .limit(1000); // Process in batches to avoid memory issues

        if (articlesError) {
            throw articlesError;
        }

        if (!articles || articles.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No articles found to update',
                updated: 0,
            });
        }

        console.log(`Updating topics for ${articles.length} articles...`);
        console.log(`Available topics: ${topics.length}`, topics.map(t => t.name).join(', '));

        let updated = 0;
        const batchSize = 50;
        let debugCount = 0;

        // Process in batches
        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            
            const updates = batch.map(article => {
                const matchedTopicIds = matchArticleToTopics(
                    article.title,
                    article.description || null,
                    topics
                );

                // Log some examples for debugging (first 5)
                if (debugCount < 5) {
                    console.log(`Article: "${article.title.substring(0, 50)}..." -> Topics: [${matchedTopicIds.length}] ${matchedTopicIds.length > 0 ? matchedTopicIds.map(id => {
                        const topic = topics.find(t => t.id === id);
                        return topic?.name || id;
                    }).join(', ') : 'NONE'}`);
                    debugCount++;
                }

                // Only update if topics changed or if article had no topics
                const hadNoTopics = !article.topic_ids || 
                    (Array.isArray(article.topic_ids) && article.topic_ids.length === 0);
                const topicsChanged = JSON.stringify(matchedTopicIds.sort()) !== 
                    JSON.stringify((article.topic_ids || []).sort());

                return {
                    id: article.id,
                    topic_ids: matchedTopicIds,
                    updated_at: new Date().toISOString(),
                    shouldUpdate: hadNoTopics || topicsChanged,
                };
            }).filter(update => update.shouldUpdate);

            // Update articles
            for (const update of updates) {
                const { error } = await supabaseService
                    .from('newsfeed_articles')
                    .update({
                        topic_ids: update.topic_ids,
                        updated_at: update.updated_at,
                    })
                    .eq('id', update.id);

                if (!error) {
                    updated++;
                } else {
                    console.error(`Error updating article ${update.id}:`, error);
                }
            }
        }

        console.log(`Updated topics for ${updated} articles`);

        return NextResponse.json({
            success: true,
            message: `Updated topics for ${updated} articles`,
            updated,
            total: articles.length,
        });
    } catch (error) {
        console.error('Error updating topics:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update topics',
            },
            { status: 500 }
        );
    }
}
