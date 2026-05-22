import type { SupabaseClient } from '@supabase/supabase-js';

export type PushPayload = {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
};

export type PushSendResult = {
    sent: boolean;
    skipped: boolean;
    error?: string;
};

/**
 * Delivers spend alerts to registered device tokens.
 * Requires user_push_subscriptions rows and optional Expo credentials.
 */
export async function sendFinanceSpendPush(
    supabase: SupabaseClient,
    payload: PushPayload
): Promise<PushSendResult> {
    const { data: subscriptions, error } = await supabase
        .from('user_push_subscriptions')
        .select('token, platform')
        .eq('user_id', payload.userId);

    if (error) {
        return { sent: false, skipped: false, error: error.message };
    }

    if (!subscriptions?.length) {
        return { sent: false, skipped: true };
    }

    const expoAccessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
    const expoTokens = subscriptions
        .filter(s => s.platform === 'expo' || s.platform === 'ios' || s.platform === 'android')
        .map(s => s.token);

    if (expoAccessToken && expoTokens.length > 0) {
        try {
            const res = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${expoAccessToken}`,
                },
                body: JSON.stringify(
                    expoTokens.map(token => ({
                        to: token,
                        title: payload.title,
                        body: payload.body,
                        data: payload.data ?? {},
                        sound: 'default',
                    }))
                ),
            });
            if (!res.ok) {
                const text = await res.text();
                return { sent: false, skipped: false, error: `Expo push failed: ${text}` };
            }
            return { sent: true, skipped: false };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Expo push error';
            return { sent: false, skipped: false, error: message };
        }
    }

    const webhookUrl = process.env.PUSH_WEBHOOK_URL?.trim();
    if (webhookUrl) {
        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: payload.userId,
                    title: payload.title,
                    body: payload.body,
                    data: payload.data ?? {},
                    tokens: subscriptions.map(s => ({ token: s.token, platform: s.platform })),
                }),
            });
            if (!res.ok) {
                return {
                    sent: false,
                    skipped: false,
                    error: `PUSH_WEBHOOK_URL returned ${res.status}`,
                };
            }
            return { sent: true, skipped: false };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Push webhook error';
            return { sent: false, skipped: false, error: message };
        }
    }

    return { sent: false, skipped: true };
}
