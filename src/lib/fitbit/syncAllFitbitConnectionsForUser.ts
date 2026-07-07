import type { SupabaseClient } from '@supabase/supabase-js';
import { syncFitbitConnection } from './syncFitbitConnection';
import type { FitbitProviderConnection, FitbitSyncResult } from './types';

export async function syncAllFitbitConnectionsForUser(
    supabase: SupabaseClient,
    userId: string,
    options?: { backfillDays?: number; triggeredBy?: 'manual' | 'oauth' }
): Promise<{
    total: number;
    synced: number;
    failed: number;
    results: FitbitSyncResult[];
}> {
    const { data: connections, error } = await supabase
        .from('fitness_provider_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'fitbit');

    if (error) {
        throw new Error(`Failed to load Fitbit connections: ${error.message}`);
    }

    const results: FitbitSyncResult[] = [];
    let synced = 0;
    let failed = 0;

    for (const connection of (connections ?? []) as FitbitProviderConnection[]) {
        const result = await syncFitbitConnection(supabase, connection, options);
        results.push(result);
        if (result.success) synced += 1;
        else failed += 1;
    }

    return {
        total: connections?.length ?? 0,
        synced,
        failed,
        results,
    };
}
