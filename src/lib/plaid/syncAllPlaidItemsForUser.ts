import type { SupabaseClient } from '@supabase/supabase-js';
import { plaidItemNeedsReauth } from '@/lib/plaid/plaidItemNeedsReauth';
import { registerPlaidItemWebhook } from '@/lib/plaid/registerPlaidItemWebhook';
import { syncPlaidTransactionsForItem } from '@/lib/plaid/syncPlaidTransactionsForItem';

export type SyncAllPlaidItemsResult = {
    total: number;
    synced: number;
    skipped: number;
    failed: number;
    webhooks_registered: number;
    transactions_added: number;
    results: Array<{
        plaid_item_id: string;
        item_id: string;
        institution_name: string | null;
        success: boolean;
        skipped?: boolean;
        skip_reason?: string;
        transactions_added?: number;
        webhook_registered?: boolean;
        error?: string;
    }>;
};

/**
 * Register webhooks (if needed) and sync every linked item for a user.
 * Used by manual sync-all, finance background sync, and integrations auto-fix.
 */
export async function syncAllPlaidItemsForUser(params: {
    supabase: SupabaseClient;
    userId: string;
    registerWebhooks?: boolean;
}): Promise<SyncAllPlaidItemsResult> {
    const { supabase, userId, registerWebhooks = true } = params;

    const { data: items, error } = await supabase
        .from('plaid_items')
        .select('id, item_id, institution_name, access_token, error_code')
        .eq('user_id', userId)
        .order('last_successful_update', { ascending: true, nullsFirst: true });

    if (error) {
        throw new Error(error.message);
    }

    const results: SyncAllPlaidItemsResult['results'] = [];
    let synced = 0;
    let skipped = 0;
    let failed = 0;
    let webhooksRegistered = 0;
    let transactionsAdded = 0;

    for (const item of items ?? []) {
        console.info('[plaid-sync-all] syncing item', {
            plaid_item_id: item.id,
            item_id: item.item_id,
            institution_name: item.institution_name,
            error_code: item.error_code,
            register_webhooks: registerWebhooks,
        });

        if (plaidItemNeedsReauth(item.error_code as string | null)) {
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                institution_name: item.institution_name,
                success: false,
                skipped: true,
                skip_reason: item.error_code ?? undefined,
                error: item.error_code as string,
            });
            skipped += 1;
            continue;
        }

        let webhookRegistered = false;
        if (registerWebhooks && item.access_token) {
            const reg = await registerPlaidItemWebhook(item.access_token);
            webhookRegistered = reg.ok;
            if (reg.ok) webhooksRegistered += 1;
        }

        try {
            const syncResult = await syncPlaidTransactionsForItem({
                supabase,
                plaidItemId: item.id,
                userId,
            });

            if (syncResult.skipped) {
                skipped += 1;
            } else {
                synced += 1;
                transactionsAdded += syncResult.transactions_added;
            }

            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                institution_name: item.institution_name,
                success: true,
                skipped: syncResult.skipped,
                skip_reason: syncResult.skip_reason,
                transactions_added: syncResult.transactions_added,
                webhook_registered: webhookRegistered,
            });

            console.info('[plaid-sync-all] item finished', {
                plaid_item_id: item.id,
                success: true,
                skipped: syncResult.skipped,
                skip_reason: syncResult.skip_reason,
                transactions_added: syncResult.transactions_added,
                notifications_sent: syncResult.notifications_sent,
                cursor_updated: syncResult.cursor_updated,
            });
        } catch (err) {
            failed += 1;
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                institution_name: item.institution_name,
                success: false,
                webhook_registered: webhookRegistered,
                error: err instanceof Error ? err.message : 'Sync failed',
            });

            console.error('[plaid-sync-all] item failed', {
                plaid_item_id: item.id,
                item_id: item.item_id,
                error: err instanceof Error ? err.message : 'Sync failed',
            });
        }
    }

    return {
        total: results.length,
        synced,
        skipped,
        failed,
        webhooks_registered: webhooksRegistered,
        transactions_added: transactionsAdded,
        results,
    };
}
