import webpush from 'web-push';

export type WebPushSubscriptionJson = {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
        p256dh: string;
        auth: string;
    };
};

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
    if (vapidConfigured) return true;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject =
        process.env.VAPID_SUBJECT?.trim() ||
        process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        'mailto:support@levelupsolutions1.com';

    if (!publicKey || !privateKey) {
        return false;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
}

export function isWebPushConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
            process.env.VAPID_PRIVATE_KEY?.trim()
    );
}

export async function sendWebPushNotification(
    subscription: WebPushSubscriptionJson,
    payload: { title: string; body: string; data?: Record<string, string> }
): Promise<{ ok: true } | { ok: false; statusCode?: number; error: string }> {
    if (!ensureVapidConfigured()) {
        return { ok: false, error: 'Web Push VAPID keys not configured' };
    }

    try {
        await webpush.sendNotification(
            subscription as webpush.PushSubscription,
            JSON.stringify({
                title: payload.title,
                body: payload.body,
                data: payload.data ?? {},
            })
        );
        return { ok: true };
    } catch (err) {
        const statusCode =
            err && typeof err === 'object' && 'statusCode' in err
                ? Number((err as { statusCode: number }).statusCode)
                : undefined;
        const message = err instanceof Error ? err.message : 'Web push send failed';
        return { ok: false, statusCode, error: message };
    }
}
