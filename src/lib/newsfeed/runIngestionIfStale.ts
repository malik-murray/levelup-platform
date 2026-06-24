import { createClient } from '@supabase/supabase-js';
import { runNewsfeedGraph } from '@/lib/newsfeed/graph/newsfeedGraph';
import type { UserFeedContext } from '@/lib/newsfeed/userFeedContext';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function getFreshnessThresholdMinutes() {
    const parsed = Number(process.env.NEWSFEED_INGEST_FRESHNESS_MINUTES || '15');
    if (!Number.isFinite(parsed) || parsed < 5) return 15;
    return parsed;
}

export type IngestionRunResult = {
    skipped: boolean;
    reason?: string;
    runId?: string | null;
    result?: Awaited<ReturnType<typeof runNewsfeedGraph>>;
};

export async function runNewsfeedIngestionIfStale(options?: {
    sourceIds?: string[];
    maxArticles?: number;
    lookbackHours?: number;
    force?: boolean;
    userFeedContext?: UserFeedContext | null;
}): Promise<IngestionRunResult> {
    const serviceDb = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    const thresholdMinutes = getFreshnessThresholdMinutes();

    if (!options?.force) {
        const freshnessCutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();
        const { data: recentSuccess } = await serviceDb
            .from('newsfeed_ingestion_runs')
            .select('id, finished_at')
            .in('status', ['success', 'partial_success'])
            .gte('finished_at', freshnessCutoff)
            .order('finished_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (recentSuccess) {
            return {
                skipped: true,
                reason: `Latest ingestion is newer than ${thresholdMinutes} minutes`,
            };
        }
    }

    const startedAt = new Date();
    let runId: string | null = null;

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

    try {
        const result = await runNewsfeedGraph({
            sourceIds: options?.sourceIds,
            maxArticles: options?.maxArticles,
            lookbackHours: options?.lookbackHours,
            userFeedContext: options?.userFeedContext,
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

        return { skipped: false, runId, result };
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

        throw error;
    }
}

/** Fire-and-forget helper for read paths that should not block on ingestion. */
export function triggerNewsfeedIngestionIfStale(options?: {
    sourceIds?: string[];
    lookbackHours?: number;
    force?: boolean;
    userFeedContext?: UserFeedContext | null;
}): void {
    void runNewsfeedIngestionIfStale(options).catch((error) => {
        console.error('[newsfeed] Background ingestion failed:', error);
    });
}
