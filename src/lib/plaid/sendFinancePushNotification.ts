import type { SupabaseClient } from '@supabase/supabase-js';
import {
    isWebPushConfigured,
    sendWebPushNotification,
    type WebPushSubscriptionJson,
} from '@/lib/push/webPushServer';

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
 * Delivers spend alerts to registered devices (Web Push + optional Expo).
 */
export async function sendFinanceSpendPush(
    supabase: SupabaseClient,
    payload: PushPayload
): Promise<PushSendResult> {
    const { data: subscriptions, error } = await supabase
        .from('user_push_subscriptions')
        .select('token, platform, push_subscription')
        .eq('user_id', payload.userId);

    if (error) {
        return { sent: false, skipped: false, error: error.message };
    }

    if (!subscriptions?.length) {
        return { sent: false, skipped: true };
    }

    let anySent = false;
    const errors: string[] = [];
    const staleEndpoints: string[] = [];

    if (isWebPushConfigured()) {
        for (const row of subscriptions) {
            if (row.platform !== 'web') continue;
            const sub = row.push_subscription as WebPushSubscriptionJson | null;
            if (!sub?.endpoint) continue;

            const result = await sendWebPushNotification(sub, {
                title: payload.title,
                body: payload.body,
                data: payload.data,
            });

            if (result.ok) {
                anySent = true;
            } else {
                errors.push(result.error);
                if (result.statusCode === 404 || result.statusCode === 410) {
                    staleEndpoints.push(sub.endpoint);
                }
            }
        }
    }

    if (staleEndpoints.length > 0) {
        await supabase
            .from('user_push_subscriptions')
            .delete()
            .eq('user_id', payload.userId)
            .in('token', staleEndpoints);
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
            if (res.ok) {
                anySent = true;
            } else {
                errors.push(`Expo: ${await res.text()}`);
            }
        } catch (err) {
            errors.push(err instanceof Error ? err.message : 'Expo push error');
        }
    }

    const webhookUrl = process.env.PUSH_WEBHOOK_URL?.trim();
    if (!anySent && webhookUrl) {
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
            if (res.ok) {
                return { sent: true, skipped: false };
            }
            errors.push(`PUSH_WEBHOOK_URL returned ${res.status}`);
        } catch (err) {
            errors.push(err instanceof Error ? err.message : 'Push webhook error');
        }
    }

    if (anySent) {
        return { sent: true, skipped: false };
    }

    if (!isWebPushConfigured() && !expoAccessToken && !webhookUrl) {
        return { sent: false, skipped: true };
    }

    return {
        sent: false,
        skipped: false,
        error: errors.join('; ') || 'No push delivery channel succeeded',
    };
}
