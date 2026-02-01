/**
 * POST /api/newsfeed/fetch
 * Trigger article fetching from RSS feeds
 * Can be called on-demand or by a cron job
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ingestArticlesFromSources } from '@/lib/newsfeed/articleIngestion';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
    try {
        // Check authentication (optional - can be called by cron with service key)
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
        
        // Optional: require auth for manual triggers, but allow service key
        const authHeader = request.headers.get('authorization');
        const isServiceKey = authHeader?.startsWith('Bearer ') && 
            authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

        if (!user && !isServiceKey) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get optional source IDs from request body
        const body = await request.json().catch(() => ({}));
        const sourceIds = body.sourceIds || undefined;

        console.log('Starting article ingestion...', {
            userId: user?.id || 'service',
            sourceIds: sourceIds?.length || 'all',
        });

        // Fetch and ingest articles
        const result = await ingestArticlesFromSources(sourceIds);

        return NextResponse.json({
            success: true,
            result: {
                sourcesProcessed: result.sourcesProcessed,
                totalArticlesFetched: result.totalArticlesFetched,
                totalArticlesInserted: result.totalArticlesInserted,
                errors: result.errors,
            },
        });
    } catch (error) {
        console.error('Error in fetch endpoint:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch articles',
            },
            { status: 500 }
        );
    }
}
