import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPlaidApi } from '@/lib/plaid/plaidApi';

export type RetiredItemResult = {
    plaid_item_id: string;
    item_id: string | null;
    plaid_item_removed: boolean;
    transactions_removed: number;
    accounts_archived: number;
    error?: string;
};

/**
 * Server-only service client. Retiring an item touches plaid_items (UPDATE/DELETE),
 * accounts, and transactions, and plaid_items has no UPDATE/DELETE RLS policy, so a
 * user-token client can't do this. Same service-role pattern as transactionSyncService.
 */
function getServiceClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * When a user re-links a bank they already had connected, Plaid issues a brand-new
 * item_id, account_ids, and transaction_ids. Left alone, the old item keeps syncing on the
 * cron and its ~90-day history double-counts against the new item's deep (730-day) pull,
 * because none of the ingest dedup keys (plaid_transaction_id, per-account pending merge)
 * match across items.
 *
 * This retires every prior item for the same (user_id, institution_id): removes it at Plaid
 * so it stops syncing, soft-deletes its synced transactions (removed_at), archives its
 * accounts, and deletes the old plaid_items row — making the freshly-linked item the single
 * source of truth. Best-effort: a Plaid itemRemove failure still proceeds with local cleanup.
 */
export async function retirePreviousPlaidItemsForInstitution(params: {
    userId: string;
    institutionId: string | null;
    keepPlaidItemDbId: string; // the newly-created row to preserve
}): Promise<RetiredItemResult[]> {
    const { userId, institutionId, keepPlaidItemDbId } = params;

    // Without an institution_id we can't reliably tell "same bank re-linked" from
    // "different bank added", so we leave prior items alone rather than risk retiring the
    // wrong connection.
    if (!institutionId) return [];

    const supabase = getServiceClient();
    if (!supabase) return [];

    const { data: oldItems } = await supabase
        .from('plaid_items')
        .select('id, item_id, access_token')
        .eq('user_id', userId)
        .eq('institution_id', institutionId)
        .neq('id', keepPlaidItemDbId);

    if (!oldItems || oldItems.length === 0) return [];

    const plaidClient = getPlaidApi();
    const results: RetiredItemResult[] = [];

    for (const item of oldItems) {
        const result: RetiredItemResult = {
            plaid_item_id: item.id,
            item_id: (item.item_id as string) ?? null,
            plaid_item_removed: false,
            transactions_removed: 0,
            accounts_archived: 0,
        };

        // 1. Stop the old item at Plaid (best-effort). If this fails the local cleanup below
        //    still runs, but the stale item is deleted so the cron won't retry syncing it.
        if (item.access_token) {
            try {
                await plaidClient.itemRemove({ access_token: item.access_token as string });
                result.plaid_item_removed = true;
            } catch (err) {
                result.error = err instanceof Error ? err.message : 'itemRemove failed';
            }
        }

        // 2. Soft-delete the old item's still-live synced transactions. Done before the
        //    plaid_items delete (below) sets their plaid_item_id to NULL via the FK cascade.
        const { data: removedTx } = await supabase
            .from('transactions')
            .update({ removed_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('plaid_item_id', item.id)
            .is('removed_at', null)
            .select('id');
        result.transactions_removed = removedTx?.length ?? 0;

        // 3. Archive the old item's accounts so they drop out of balances/net worth.
        const { data: archivedAccounts } = await supabase
            .from('accounts')
            .update({ is_archived: true })
            .eq('user_id', userId)
            .eq('plaid_item_id', item.id)
            .select('id');
        result.accounts_archived = archivedAccounts?.length ?? 0;

        // 4. Delete the retired plaid_items row. accounts.plaid_item_id and
        //    transactions.plaid_item_id are ON DELETE SET NULL, so this is safe.
        await supabase.from('plaid_items').delete().eq('id', item.id);

        results.push(result);
    }

    return results;
}
