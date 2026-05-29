'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@auth/supabaseClient';

const STORAGE_KEY = 'plaid-webhook-bootstrap-at';
const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Re-registers Plaid webhooks periodically while logged in.
 * Webhooks are what deliver updates when the app is fully closed.
 */
export function PlaidWebhookBootstrap() {
    const ranRef = useRef(false);

    useEffect(() => {
        if (ranRef.current) return;
        ranRef.current = true;

        const run = async () => {
            const last = localStorage.getItem(STORAGE_KEY);
            if (last && Date.now() - Number(last) < INTERVAL_MS) return;

            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const { count } = await supabase
                .from('plaid_items')
                .select('id', { count: 'exact', head: true });
            if (!count) return;

            try {
                const res = await fetch('/api/plaid/register-webhooks', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (res.ok) {
                    localStorage.setItem(STORAGE_KEY, String(Date.now()));
                }
            } catch {
                // Cron + manual register remain available
            }
        };

        void run();
    }, []);

    return null;
}
