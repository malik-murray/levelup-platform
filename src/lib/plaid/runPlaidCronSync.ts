import type { SupabaseClient } from '@supabase/supabase-js';
import { plaidItemNeedsReauth } from '@/lib/plaid/plaidItemNeedsReauth';
import { shouldRequestPlaidRefresh } from '@/lib/plaid/shouldRequestPlaidRefresh';
import { syncPlaidTransactionsForItem } from '@/lib/plaid/syncPlaidTransactionsForItem';

export async function runPlaidCronSync(
    supabase: SupabaseClient,
    options?: { allowRefresh?: boolean }
): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    refresh_count: number;
    transactions_added: number;
    notifications_sent: number;
    results: Array<Record<string, unknown>>;
}> {
    const allowRefresh = options?.allowRefresh ?? false;

    const { data: items, error } = await supabase
        .from('plaid_items')
        .select(
            'id, user_id, item_id, institution_name, error_code, last_plaid_refresh_at, last_webhook_at, last_successful_update'
        )
        .order('last_successful_update', { ascending: true, nullsFirst: true });

    if (error) {
        throw new Error(`Failed to list plaid_items: ${error.message}`);
    }

    const results: Array<Record<string, unknown>> = [];
    let refreshCount = 0;
    let transactionsAdded = 0;
    let notificationsSent = 0;

    for (const item of items ?? []) {
        if (plaidItemNeedsReauth(item.error_code as string | null)) {
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                success: false,
                error: `skipped:${item.error_code}`,
            });
            continue;
        }

        const requestRefresh =
            allowRefresh &&
            shouldRequestPlaidRefresh({
                lastPlaidRefreshAt: item.last_plaid_refresh_at as string | null,
                lastWebhookAt: item.last_webhook_at as string | null,
                lastSuccessfulUpdate: item.last_successful_update as string | null,
            });

        if (requestRefresh) refreshCount += 1;

        try {
            const syncResult = await syncPlaidTransactionsForItem({
                supabase,
                plaidItemId: item.id,
                userId: item.user_id as string,
                requestRefresh,
                refreshWaitMs: requestRefresh ? 12_000 : 0,
            });
            transactionsAdded += syncResult.transactions_added;
            notificationsSent += syncResult.notifications_sent;
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                success: true,
                request_refresh: requestRefresh,
                transactions_added: syncResult.transactions_added,
                notifications_sent: syncResult.notifications_sent,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('[plaid-cron] item sync failed', {
                plaid_item_id: item.id,
                item_id: item.item_id,
                message,
            });
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                success: false,
                error: message,
            });
        }
    }

    const succeeded = results.filter(r => r.success === true).length;
    const failed = results.filter(r => r.success === false).length;

    return {
        total: results.length,
        succeeded,
        failed,
        refresh_count: refreshCount,
        transactions_added: transactionsAdded,
        notifications_sent: notificationsSent,
        results,
    };
}
