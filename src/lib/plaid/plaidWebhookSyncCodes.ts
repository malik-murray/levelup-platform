/** Plaid TRANSACTIONS webhook codes that mean we should run /transactions/sync. */
export const PLAID_TRANSACTIONS_SYNC_WEBHOOK_CODES = new Set([
    'SYNC_UPDATES_AVAILABLE',
    'DEFAULT_UPDATE',
    'INITIAL_UPDATE',
    'HISTORICAL_UPDATE',
]);

export function shouldSyncForTransactionsWebhook(webhookCode: string | undefined): boolean {
    return Boolean(webhookCode && PLAID_TRANSACTIONS_SYNC_WEBHOOK_CODES.has(webhookCode));
}
