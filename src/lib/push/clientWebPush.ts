'use client';

export type PushSubscribeResult =
    | { ok: true }
    | { ok: false; reason: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

export function isWebPushSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

export async function registerFinanceServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function subscribeToFinancePush(accessToken: string): Promise<PushSubscribeResult> {
    if (!isWebPushSupported()) {
        return { ok: false, reason: 'Push notifications are not supported in this browser.' };
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapidPublicKey) {
        return { ok: false, reason: 'Push is not configured on the server (missing VAPID key).' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return { ok: false, reason: 'Notification permission was denied.' };
    }

    const registration = await registerFinanceServiceWorker();
    if (!registration) {
        return { ok: false, reason: 'Could not register the notification service worker.' };
    }

    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
    }

    const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            subscription: subscription.toJSON(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
            ok: false,
            reason: (err as { error?: string }).error || 'Failed to save push subscription.',
        };
    }

    return { ok: true };
}

export async function unsubscribeFromFinancePush(accessToken: string): Promise<PushSubscribeResult> {
    if (!isWebPushSupported()) {
        return { ok: true };
    }

    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
        await subscription.unsubscribe();
    }

    const res = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            endpoint: subscription?.endpoint ?? null,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
            ok: false,
            reason: (err as { error?: string }).error || 'Failed to remove push subscription.',
        };
    }

    return { ok: true };
}
