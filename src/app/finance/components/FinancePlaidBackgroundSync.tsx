'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'finance-plaid-last-bg-sync';

function shouldRunBackgroundSync(): boolean {
    if (typeof window === 'undefined') return false;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last >= SYNC_INTERVAL_MS;
}

function markBackgroundSyncRan(): void {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
}

/**
 * Pulls latest Plaid transactions when the user opens Finance (debounced per tab session).
 * Complements webhooks + hourly cron so data stays fresh even if Plaid never called the webhook.
 */
export function FinancePlaidBackgroundSync() {
    const pathname = usePathname();
    const runningRef = useRef(false);

    useEffect(() => {
        if (!pathname?.startsWith('/finance')) return;

        const run = async () => {
            if (runningRef.current || !shouldRunBackgroundSync()) return;
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

                const response = await fetch('/api/plaid/sync-all', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ register_webhooks: true }),
                });

                if (response.ok) {
                    markBackgroundSyncRan();
                }
            } catch {
                // Silent — manual sync and cron remain available
            } finally {
                runningRef.current = false;
            }
        };

        void run();

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void run();
            }
        };

        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [pathname]);

    return null;
}
