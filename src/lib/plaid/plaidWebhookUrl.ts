/** Production webhook URL for Plaid item + Link registration. */
export function getPlaidWebhookUrl(): string | undefined {
    const explicit = process.env.PLAID_WEBHOOK_URL?.trim();
    if (explicit) return explicit.replace(/\/$/, '');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (appUrl) {
        return `${appUrl.replace(/\/$/, '')}/api/plaid/webhook`;
    }

    return undefined;
}
