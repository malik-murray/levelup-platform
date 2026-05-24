'use client';

import { useEffect } from 'react';

/** Ensures users get the latest push notification handler (category action buttons). */
export function ServiceWorkerUpdater() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js').then(reg => {
            reg.update().catch(() => {});
        });
    }, []);
    return null;
}
