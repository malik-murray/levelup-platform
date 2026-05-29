/** Minimum hours between Plaid /transactions/refresh calls per item (Plaid rate limits apply). */
export const PLAID_REFRESH_MIN_INTERVAL_HOURS = 4;

export function shouldRequestPlaidRefresh(params: {
    lastPlaidRefreshAt: string | null | undefined;
    lastWebhookAt?: string | null;
    lastSuccessfulUpdate?: string | null;
    /** Force refresh when we have not heard from Plaid webhooks in this many hours. */
    staleWebhookHours?: number;
}): boolean {
    const minIntervalMs = PLAID_REFRESH_MIN_INTERVAL_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    if (params.lastPlaidRefreshAt) {
        const lastRefresh = new Date(params.lastPlaidRefreshAt).getTime();
        if (Number.isFinite(lastRefresh) && now - lastRefresh < minIntervalMs) {
            return false;
        }
    }

    const staleWebhookHours = params.staleWebhookHours ?? 12;
    if (params.lastWebhookAt) {
        const lastWebhook = new Date(params.lastWebhookAt).getTime();
        if (Number.isFinite(lastWebhook) && now - lastWebhook < staleWebhookHours * 60 * 60 * 1000) {
            // Webhooks are flowing — cursor sync is enough; save refresh quota.
            return false;
        }
    }

    // No recent webhook: refresh if sync is stale or we never refreshed.
    if (!params.lastSuccessfulUpdate) return true;
    const lastSync = new Date(params.lastSuccessfulUpdate).getTime();
    if (!Number.isFinite(lastSync)) return true;

    const staleSyncHours = 2;
    return now - lastSync > staleSyncHours * 60 * 60 * 1000;
}
