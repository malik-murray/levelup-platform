import type { SupabaseClient } from '@supabase/supabase-js';
import { linkInternalTransferPairsForUser } from '@/lib/financial-concierge/linkInternalTransferPairs';
import { getPlaidApi } from '@/lib/plaid/plaidApi';
import {
    buildPlaidAccountIdMap,
    processPlaidSyncBatch,
    syncPlaidAccountsForItem,
    type PlaidSyncStats,
} from '@/lib/plaid/persistPlaidSyncTransactions';
import { requestPlaidTransactionRefresh } from '@/lib/plaid/requestPlaidTransactionRefresh';

const SYNC_LOCK_MINUTES = 5;

export type SyncPlaidTransactionsResult = {
    success: boolean;
    skipped?: boolean;
    skip_reason?: string;
    refresh_requested?: boolean;
    refresh_error?: string;
    accounts_synced: number;
    transactions_added: number;
    transactions_modified: number;
    transactions_removed: number;
    pending_inserted: number;
    pending_merged_to_posted: number;
    duplicate_posted_skipped: number;
    notifications_sent: number;
    transfer_pairs_linked: number;
    transfer_rows_category_fixed: number;
    cursor_updated: boolean;
};

function mergeStats(into: PlaidSyncStats, batch: PlaidSyncStats): void {
    into.added += batch.added;
    into.modified += batch.modified;
    into.removed += batch.removed;
    into.pending_inserted += batch.pending_inserted;
    into.pending_merged_to_posted += batch.pending_merged_to_posted;
    into.duplicate_posted_skipped += batch.duplicate_posted_skipped;
    into.notifications_sent += batch.notifications_sent;
}

function emptyStats(): PlaidSyncStats {
    return {
        added: 0,
        modified: 0,
        removed: 0,
        pending_inserted: 0,
        pending_merged_to_posted: 0,
        duplicate_posted_skipped: 0,
        notifications_sent: 0,
    };
}

/**
 * Sync one Plaid item via /transactions/sync (cursor-based).
 * Safe to call from webhooks, manual sync, and cron.
 */
export async function syncPlaidTransactionsForItem(params: {
    supabase: SupabaseClient;
    /** UUID primary key from plaid_items.id */
    plaidItemId: string;
    userId?: string;
    /** Ask Plaid to pull latest from bank before syncing (helps pending transactions). */
    requestRefresh?: boolean;
}): Promise<SyncPlaidTransactionsResult> {
    const { supabase, plaidItemId } = params;
    const plaidClient = getPlaidApi();

    const { data: plaidItem, error: itemError } = await supabase
        .from('plaid_items')
        .select(
            'id, user_id, item_id, access_token, transactions_cursor, sync_in_progress_at, error_code, error_message'
        )
        .eq('id', plaidItemId)
        .maybeSingle();

    if (itemError || !plaidItem?.access_token) {
        throw new Error(itemError?.message || 'Plaid item not found');
    }

    const userId = params.userId ?? (plaidItem.user_id as string);
    const lockCutoff = new Date(Date.now() - SYNC_LOCK_MINUTES * 60 * 1000);

    if (
        plaidItem.sync_in_progress_at &&
        new Date(plaidItem.sync_in_progress_at as string) > lockCutoff
    ) {
        console.info('[plaid-sync] skipped — sync already in progress', {
            plaidItemId,
            item_id: plaidItem.item_id,
        });
        return {
            success: true,
            skipped: true,
            skip_reason: 'sync_in_progress',
            refresh_requested: false,
            accounts_synced: 0,
            transactions_added: 0,
            transactions_modified: 0,
            transactions_removed: 0,
            pending_inserted: 0,
            pending_merged_to_posted: 0,
            duplicate_posted_skipped: 0,
            notifications_sent: 0,
            transfer_pairs_linked: 0,
            transfer_rows_category_fixed: 0,
            cursor_updated: false,
        };
    }

    await supabase
        .from('plaid_items')
        .update({ sync_in_progress_at: new Date().toISOString() })
        .eq('id', plaidItemId);

    const stats = emptyStats();
    let cursorUpdated = false;
    let refreshRequested = false;
    let refreshError: string | undefined;

    try {
        console.info('[plaid-sync] started', {
            plaidItemId,
            item_id: plaidItem.item_id,
            has_cursor: Boolean(plaidItem.transactions_cursor),
            request_refresh: Boolean(params.requestRefresh),
        });

        if (params.requestRefresh) {
            const refresh = await requestPlaidTransactionRefresh({
                plaidClient,
                accessToken: plaidItem.access_token,
                itemId: plaidItem.item_id as string,
            });
            refreshRequested = refresh.requested;
            refreshError = refresh.error;
            if (refresh.requested) {
                // Plaid refresh is async; give the institution a moment before cursor sync.
                await new Promise(resolve => setTimeout(resolve, 15_000));
            }
        }

        const accountsSynced = await syncPlaidAccountsForItem({
            supabase,
            userId,
            plaidItemDbId: plaidItemId,
            accessToken: plaidItem.access_token,
            plaidClient,
        });

        let cursor: string | undefined =
            (plaidItem.transactions_cursor as string | null) ?? undefined;
        let hasMore = true;

        while (hasMore) {
            const syncResponse = await plaidClient.transactionsSync({
                access_token: plaidItem.access_token,
                cursor,
                options: {
                    include_personal_finance_category: true,
                },
            });

            const data = syncResponse.data;
            const accountIdMap = await buildPlaidAccountIdMap(supabase, plaidItemId);

            const batchStats = await processPlaidSyncBatch({
                supabase,
                userId,
                plaidItemDbId: plaidItemId,
                accountIdMap,
                added: data.added,
                modified: data.modified,
                removed: data.removed,
            });
            mergeStats(stats, batchStats);

            cursor = data.next_cursor;
            hasMore = data.has_more;
        }

        const now = new Date().toISOString();
        const itemUpdate: Record<string, string | null> = {
            last_successful_update: now,
            error_code: null,
            error_message: null,
        };
        if (cursor) {
            itemUpdate.transactions_cursor = cursor;
        }

        const { error: cursorError } = await supabase
            .from('plaid_items')
            .update(itemUpdate)
            .eq('id', plaidItemId);

        if (!cursorError && cursor) cursorUpdated = true;

        const linkResult = await linkInternalTransferPairsForUser(supabase, userId, {
            sinceDays: 120,
        });

        console.info('[plaid-sync] completed', {
            plaidItemId,
            item_id: plaidItem.item_id,
            accounts_synced: accountsSynced,
            added: stats.added,
            modified: stats.modified,
            removed: stats.removed,
            pending_inserted: stats.pending_inserted,
            pending_merged_to_posted: stats.pending_merged_to_posted,
            duplicate_posted_skipped: stats.duplicate_posted_skipped,
            notifications_sent: stats.notifications_sent,
        });

        return {
            success: true,
            refresh_requested: refreshRequested,
            refresh_error: refreshError,
            accounts_synced: accountsSynced,
            transactions_added: stats.added,
            transactions_modified: stats.modified,
            transactions_removed: stats.removed,
            pending_inserted: stats.pending_inserted,
            pending_merged_to_posted: stats.pending_merged_to_posted,
            duplicate_posted_skipped: stats.duplicate_posted_skipped,
            notifications_sent: stats.notifications_sent,
            transfer_pairs_linked: linkResult.pairsLinked,
            transfer_rows_category_fixed: linkResult.transferRowsCategoryFixed,
            cursor_updated: cursorUpdated,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown sync error';
        console.error('[plaid-sync] error', { plaidItemId, item_id: plaidItem.item_id, message });
        await supabase
            .from('plaid_items')
            .update({
                error_code: 'SYNC_FAILED',
                error_message: message.slice(0, 500),
            })
            .eq('id', plaidItemId);
        throw err;
    } finally {
        await supabase
            .from('plaid_items')
            .update({ sync_in_progress_at: null })
            .eq('id', plaidItemId);
    }
}
