import type { SupabaseClient } from '@supabase/supabase-js';
import { syncFitbitConnection } from './syncFitbitConnection';
import type { FitbitProviderConnection } from './types';

export async function runFitbitCronSync(supabase: SupabaseClient): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<Record<string, unknown>>;
}> {
    const { data: connections, error } = await supabase
        .from('fitness_provider_connections')
        .select('*')
        .eq('provider', 'fitbit')
        .order('last_successful_sync_at', { ascending: true, nullsFirst: true });

    if (error) {
        throw new Error(`Failed to list fitness_provider_connections: ${error.message}`);
    }

    const results: Array<Record<string, unknown>> = [];
    let succeeded = 0;
    let failed = 0;

    for (const connection of (connections ?? []) as FitbitProviderConnection[]) {
        const syncResult = await syncFitbitConnection(supabase, connection, {
            triggeredBy: 'cron',
            backfillDays: 7,
        });

        results.push({
            connection_id: connection.id,
            user_id: connection.user_id,
            success: syncResult.success,
            steps_days: syncResult.steps_days,
            sleep_days: syncResult.sleep_days,
            workouts: syncResult.workouts,
            error: syncResult.error ?? null,
        });

        if (syncResult.success) succeeded += 1;
        else failed += 1;
    }

    return {
        total: connections?.length ?? 0,
        succeeded,
        failed,
        results,
    };
}
