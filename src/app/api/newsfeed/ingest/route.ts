import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { runNewsfeedGraph } from '@/lib/newsfeed/graph/newsfeedGraph';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

function isServiceRoleAuthorized(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    return Boolean(token && process.env.SUPABASE_SERVICE_ROLE_KEY && token === process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getFreshnessThresholdMinutes() {
    const parsed = Number(process.env.NEWSFEED_INGEST_FRESHNESS_MINUTES || '45');
    if (!Number.isFinite(parsed) || parsed < 5) return 45;
    return parsed;
}

export async function POST(request: NextRequest) {
    const startedAt = new Date();
    const serviceDb = createClient(supabaseUrl, supabaseServiceKey);
    let runId: string | null = null;

    try {
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
        const serviceAuthorized = isServiceRoleAuthorized(request);
        if (!user && !serviceAuthorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const thresholdMinutes = getFreshnessThresholdMinutes();
        const freshnessCutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
        const { data: recentSuccess } = await serviceDb
            .from('newsfeed_ingestion_runs')
            .select('id, finished_at')
            .eq('status', 'success')
            .gte('finished_at', freshnessCutoff)
            .order('finished_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (recentSuccess) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: `Latest successful ingestion is newer than ${thresholdMinutes} minutes`,
                latestRun: recentSuccess,
            });
        }

        const body = await request.json().catch(() => ({}));
        const sourceIds = Array.isArray(body.sourceIds) ? body.sourceIds : undefined;
        const maxArticles = typeof body.maxArticles === 'number' ? body.maxArticles : undefined;
        const lookbackHours = typeof body.lookbackHours === 'number' ? body.lookbackHours : undefined;

        const { data: runRow, error: createRunError } = await serviceDb
            .from('newsfeed_ingestion_runs')
            .insert({
                started_at: startedAt.toISOString(),
                status: 'running',
            })
            .select('id')
            .single();

        if (!createRunError) {
            runId = runRow.id;
        }

        const result = await runNewsfeedGraph({
            sourceIds,
            maxArticles,
            lookbackHours,
        });

        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const status = result.errors.length > 0 ? 'partial_success' : 'success';

        if (runId) {
            await serviceDb
                .from('newsfeed_ingestion_runs')
                .update({
                    finished_at: finishedAt.toISOString(),
                    duration_ms: durationMs,
                    sources_processed: result.sourcesProcessedCount,
                    total_fetched: result.fetchedCount,
                    total_inserted: result.insertedCount,
                    exact_topic_assignments: result.exactTopicAssignments,
                    fallback_topic_assignments: result.fallbackTopicAssignments,
                    failed_batches: result.failedBatches,
                    inactive_feeds: result.inactiveFeeds,
                    errors: result.errors,
                    status,
                })
                .eq('id', runId);
        }

        return NextResponse.json({
            success: true,
            skipped: false,
            runId,
            result,
        });
    } catch (error) {
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const message = error instanceof Error ? error.message : 'Failed to run ingestion';

        if (runId) {
            await serviceDb
                .from('newsfeed_ingestion_runs')
                .update({
                    finished_at: finishedAt.toISOString(),
                    duration_ms: durationMs,
                    errors: [message],
                    status: 'failed',
                })
                .eq('id', runId);
        }

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
