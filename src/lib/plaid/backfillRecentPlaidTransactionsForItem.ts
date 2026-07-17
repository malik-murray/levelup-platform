import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlaidApi } from '@/lib/plaid/plaidApi';
import {
    buildPlaidAccountIdMap,
    processPlaidSyncBatch,
    syncPlaidAccountsForItem,
} from '@/lib/plaid/persistPlaidSyncTransactions';

function isoDateDaysAgo(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

export type BackfillRecentResult = {
    plaid_item_id: string;
    success: boolean;
    fetched: number;
    added: number;
    modified: number;
    removed: number;
    error?: string;
};

/**
 * One-time fallback pull for recent history via /transactions/get.
 * Useful when cursor sync resumed but a past date window is missing.
 */
export async function backfillRecentPlaidTransactionsForItem(params: {
    supabase: SupabaseClient;
    plaidItemId: string;
    userId?: string;
    days?: number;
}): Promise<BackfillRecentResult> {
    const { supabase, plaidItemId } = params;
    // Cap at 730 days (Plaid's max history window) so a one-time deep backfill can pull
    // up to ~24 months; the daily gap-fill still passes a small `days` value.
    const days = Math.max(1, Math.min(params.days ?? 14, 730));

    const { data: plaidItem, error: itemError } = await supabase
        .from('plaid_items')
        .select('id, user_id, item_id, access_token')
        .eq('id', plaidItemId)
        .maybeSingle();

    if (itemError || !plaidItem?.access_token) {
        return {
            plaid_item_id: plaidItemId,
            success: false,
            fetched: 0,
            added: 0,
            modified: 0,
            removed: 0,
            error: itemError?.message || 'Plaid item not found',
        };
    }

    const userId = params.userId ?? (plaidItem.user_id as string);
    const plaidClient = getPlaidApi();

    try {
        await syncPlaidAccountsForItem({
            supabase,
            userId,
            plaidItemDbId: plaidItemId,
            accessToken: plaidItem.access_token,
            plaidClient,
        });
        const accountIdMap = await buildPlaidAccountIdMap(supabase, plaidItemId);

        let fetched = 0;
        let offset = 0;
        const count = 500;
        let total = 0;
        let added = 0;
        let modified = 0;
        let removed = 0;

        const startDate = isoDateDaysAgo(days);
        const endDate = new Date().toISOString().slice(0, 10);

        do {
            const res = await plaidClient.transactionsGet({
                access_token: plaidItem.access_token,
                start_date: startDate,
                end_date: endDate,
                options: {
                    count,
                    offset,
                    include_personal_finance_category: true,
                },
            });

            const txs = res.data.transactions ?? [];
            fetched += txs.length;
            total = res.data.total_transactions ?? fetched;

            const batch = await processPlaidSyncBatch({
                supabase,
                userId,
                plaidItemDbId: plaidItemId,
                accountIdMap,
                added: txs,
                modified: [],
                removed: [],
            });

            added += batch.added;
            modified += batch.modified;
            removed += batch.removed;
            offset += txs.length;
        } while (offset < total);

        await supabase
            .from('plaid_items')
            .update({
                last_successful_update: new Date().toISOString(),
                error_code: null,
                error_message: null,
            })
            .eq('id', plaidItemId);

        return {
            plaid_item_id: plaidItemId,
            success: true,
            fetched,
            added,
            modified,
            removed,
        };
    } catch (err) {
        return {
            plaid_item_id: plaidItemId,
            success: false,
            fetched: 0,
            added: 0,
            modified: 0,
            removed: 0,
            error: err instanceof Error ? err.message : 'Backfill failed',
        };
    }
}
