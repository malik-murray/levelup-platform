import { getPlaidApi } from '@/lib/plaid/plaidApi';
import { getPlaidWebhookUrl } from '@/lib/plaid/plaidWebhookUrl';

export type RegisterWebhookResult = {
    ok: boolean;
    webhookUrl?: string;
    error?: string;
};

/**
 * Tell Plaid to send TRANSACTIONS webhooks for this item to our /api/plaid/webhook URL.
 * Required for items linked before PLAID_WEBHOOK_URL was configured.
 */
export async function registerPlaidItemWebhook(accessToken: string): Promise<RegisterWebhookResult> {
    const webhookUrl = getPlaidWebhookUrl();
    if (!webhookUrl) {
        return {
            ok: false,
            error: 'PLAID_WEBHOOK_URL or NEXT_PUBLIC_APP_URL is not configured',
        };
    }

    try {
        const plaidClient = getPlaidApi();
        await plaidClient.itemWebhookUpdate({
            access_token: accessToken,
            webhook: webhookUrl,
        });
        console.info('[plaid-webhook-register] updated item webhook', { webhookUrl });
        return { ok: true, webhookUrl };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'itemWebhookUpdate failed';
        console.error('[plaid-webhook-register] failed', message);
        return { ok: false, error: message };
    }
}
