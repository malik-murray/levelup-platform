'use client';

import { useState } from 'react';
import { supabase } from '@auth/supabaseClient';

type Props = {
    className?: string;
};

export function HabitReminderTestButton({ className = '' }: Props) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const sendTest = async () => {
        if (busy) return;
        setBusy(true);
        setMessage(null);

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
                    setMessage('Enable push notifications in Settings first.');
                    return;
                }
            }

            const res = await fetch('/api/push/test-habit', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ kind: 'priorities_setup' }),
            });
            const data = (await res.json()) as { message?: string; error?: string };
            setMessage(
                res.ok && data.message ? data.message : data.error || 'Test notification failed.'
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={className}>
            <button
                type="button"
                disabled={busy}
                onClick={() => void sendTest()}
                className="w-full rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-[#ff9d00]/50 dark:bg-black/40 dark:text-[#ffe066] dark:hover:bg-[#ff9d00]/10"
            >
                {busy ? 'Sending…' : 'Send test habit reminder'}
            </button>
            {message ? (
                <p className="mt-2 text-center text-xs text-amber-800 dark:text-[#ffe066]/90">{message}</p>
            ) : null}
        </div>
    );
}
