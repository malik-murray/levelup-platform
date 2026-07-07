export const FITBIT_SCOPES = [
    'activity',
    'heartrate',
    'sleep',
    'weight',
    'profile',
] as const;

export const FITBIT_AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
export const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
export const FITBIT_REVOKE_URL = 'https://api.fitbit.com/oauth2/revoke';
export const FITBIT_API_BASE = 'https://api.fitbit.com';

export const FITBIT_DEFAULT_BACKFILL_DAYS = 30;

export function getFitbitRedirectUri(): string {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    if (!base) {
        throw new Error('NEXT_PUBLIC_APP_URL is not configured');
    }
    return `${base}/api/fitness/fitbit/oauth/callback`;
}

export function getFitbitWebhookUrl(): string | null {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    if (!base) return null;
    return `${base}/api/fitness/fitbit/webhook`;
}

export function isFitbitConfigured(): boolean {
    return Boolean(
        process.env.FITBIT_CLIENT_ID?.trim() &&
            process.env.FITBIT_CLIENT_SECRET?.trim() &&
            process.env.NEXT_PUBLIC_APP_URL?.trim()
    );
}

export function subscriptionIdToConnectionId(subscriptionId: string): string | null {
    const normalized = subscriptionId.replace(/\.json$/, '');
    if (normalized.length !== 32) return null;
    return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}
