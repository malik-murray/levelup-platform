'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';

const DELAYED_TEST_SECONDS = 30;

type Props = {
    className?: string;
    showSettingsLink?: boolean;
};

export function SpendAlertTestButton({ className = '', showSettingsLink = false }: Props) {
    const [busy, setBusy] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

    const clearCountdown = () => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        setCountdown(null);
    };

    const sendTest = async (delaySeconds = 0) => {
        if (busy) return;
        setBusy(true);
        setMessage(null);
        clearCountdown();

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setMessage('Please log in again.');
                return;
            }

            const statusRes = await fetch('/api/push/status', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (statusRes.ok) {
                const status = (await statusRes.json()) as { subscribed?: boolean };
                if (!status.subscribed) {
                    setMessage('Enable Spend alerts in Settings first.');
                    return;
                }
            }

            const res = await fetch('/api/push/test', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(delaySeconds > 0 ? { delaySeconds } : {}),
            });
            const data = (await res.json()) as { message?: string; error?: string; scheduled?: boolean };
            if (res.ok && data.scheduled && delaySeconds > 0) {
                setMessage(data.message || `Close the app now — test arrives in ${delaySeconds}s.`);
                let remaining = delaySeconds;
                setCountdown(remaining);
                countdownRef.current = setInterval(() => {
                    remaining -= 1;
                    if (remaining <= 0) {
                        clearCountdown();
                        setMessage('Test should have arrived. Did you see a banner with the app closed?');
                        return;
                    }
                    setCountdown(remaining);
                }, 1000);
                return;
            }

            setMessage(
                res.ok && data.message
                    ? data.message
                    : data.error || 'Test notification failed.'
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={className}>
            <button
                type="button"
                disabled={busy || countdown !== null}
                onClick={() => void sendTest(DELAYED_TEST_SECONDS)}
                className="w-full rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-[#ff9d00]/50 dark:bg-black/40 dark:text-[#ffe066] dark:hover:bg-[#ff9d00]/10"
            >
                {countdown !== null
                    ? `Close app now — ${countdown}s`
                    : busy
                      ? 'Scheduling…'
                      : `Test in ${DELAYED_TEST_SECONDS}s (close app)`}
            </button>
            <button
                type="button"
                disabled={busy || countdown !== null}
                onClick={() => void sendTest()}
                className="mt-2 w-full rounded-lg border border-slate-300/80 bg-white/80 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-black/30 dark:text-slate-400 dark:hover:bg-black/50"
            >
                Send immediately
            </button>
            {message ? (
                <p className="mt-2 text-center text-xs text-amber-800 dark:text-[#ffe066]/90">{message}</p>
            ) : null}
            {showSettingsLink ? (
                <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                    <Link href="/settings" className="underline">
                        Settings
                    </Link>{' '}
                    → Spend alerts (push)
                </p>
            ) : null}
        </div>
    );
}
