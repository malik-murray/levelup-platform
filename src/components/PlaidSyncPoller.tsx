'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@auth/supabaseClient';

/** Poll Plaid while the app is open (PWA foreground). */
const SYNC_INTERVAL_MS = 3 * 60 * 1000;
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

const LAST_SYNC_KEY = 'plaid-poller-last-sync';
const LAST_REFRESH_KEY = 'plaid-poller-last-refresh';

function getLast(key: string): number {
    const raw = localStorage.getItem(key);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
}

function setLast(key: string): void {
    localStorage.setItem(key, String(Date.now()));
}

/**
 * Keeps transactions fresh while LevelUp is open on your phone/desktop.
 * True background (app closed) still relies on Plaid webhooks + Vercel cron.
 */
export function PlaidSyncPoller() {
    const runningRef = useRef(false);

    useEffect(() => {
        const run = async () => {
            if (runningRef.current || document.visibilityState !== 'visible') return;

            const sinceSync = Date.now() - getLast(LAST_SYNC_KEY);
            if (sinceSync < SYNC_INTERVAL_MS) return;

            runningRef.current = true;
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const { count } = await supabase
                    .from('plaid_items')
                    .select('id', { count: 'exact', head: true });
                if (!count) return;

                const sinceRefresh = Date.now() - getLast(LAST_REFRESH_KEY);
                const requestRefresh = sinceRefresh >= REFRESH_INTERVAL_MS;

                const response = await fetch('/api/plaid/sync-all', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        register_webhooks: false,
                        request_refresh: requestRefresh,
                    }),
                });

                if (response.ok) {
                    setLast(LAST_SYNC_KEY);
                    if (requestRefresh) setLast(LAST_REFRESH_KEY);
                }
            } catch {
                // Cron/webhooks/manual sync remain available
            } finally {
                runningRef.current = false;
            }
        };

        void run();
        const interval = window.setInterval(() => void run(), SYNC_INTERVAL_MS);

        const onVisible = () => {
            if (document.visibilityState === 'visible') void run();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    return null;
}
