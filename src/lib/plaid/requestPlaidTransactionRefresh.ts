import type { PlaidApi } from 'plaid';

/**
 * Ask Plaid to pull the latest transactions from the bank (including pending when supported).
 * Async on Plaid's side — follow with /transactions/sync after a short wait or via webhook.
 */
export async function requestPlaidTransactionRefresh(params: {
    plaidClient: PlaidApi;
    accessToken: string;
    itemId?: string;
}): Promise<{ requested: boolean; error?: string }> {
    try {
        await params.plaidClient.transactionsRefresh({
            access_token: params.accessToken,
        });
        console.info('[plaid-refresh] requested', { item_id: params.itemId });
        return { requested: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'transactionsRefresh failed';
        console.warn('[plaid-refresh] failed', { item_id: params.itemId, message });
        return { requested: false, error: message };
    }
}
