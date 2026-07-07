'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { supabase } from '@auth/supabaseClient';
import { normalizeTimeToHHMM } from '@/lib/habit/habitReminderUtils';

type FitnessReminderPrefsState = {
    notifyWorkoutReminderEnabled: boolean;
    timezone: string;
    workoutReminderTime: string;
};

type Props = {
    rowShell: (className?: string) => string;
    NeonToggle: ComponentType<{
        checked: boolean;
        onChange: (v: boolean) => void;
        id?: string;
        'aria-label'?: string;
    }>;
};

export function FitnessReminderSettings({ rowShell, NeonToggle }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [prefs, setPrefs] = useState<FitnessReminderPrefsState>({
        notifyWorkoutReminderEnabled: false,
        timezone: 'America/New_York',
        workoutReminderTime: '18:00',
    });
    const prefsRef = useRef(prefs);
    prefsRef.current = prefs;
    const timeInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const res = await fetch('/api/push/fitness-preferences', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (res.ok) {
                    const data = (await res.json()) as FitnessReminderPrefsState;
                    setPrefs(data);
                }
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const savePrefs = async (next: FitnessReminderPrefsState) => {
        setSaving(true);
        setMessage(null);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setMessage('Please log in again.');
                return;
            }

            const res = await fetch('/api/push/fitness-preferences', {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...next,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (!res.ok) {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                setMessage(err.error || 'Could not save workout reminder settings.');
                return;
            }

            setPrefs(next);
            setMessage('Workout reminder saved.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <p className="px-1 text-center text-xs text-slate-500 dark:text-slate-400">
                Loading workout reminder settings…
            </p>
        );
    }

    return (
        <div className="space-y-2">
            <div className={rowShell()}>
                <span className="flex-1 text-slate-800 dark:text-white">Workout reminders</span>
                <NeonToggle
                    checked={prefs.notifyWorkoutReminderEnabled}
                    onChange={(on) => void savePrefs({ ...prefsRef.current, notifyWorkoutReminderEnabled: on })}
                    aria-label="Workout reminder notifications"
                />
            </div>
            <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
                Nudges you if today&apos;s scheduled workout is still open — keeps your streak accountable.
            </p>

            {prefs.notifyWorkoutReminderEnabled ? (
                <div className={`${rowShell()} flex-col items-stretch gap-2`}>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Reminder time</p>
                    <input
                        ref={timeInputRef}
                        type="time"
                        defaultValue={prefs.workoutReminderTime}
                        disabled={saving}
                        onChange={(e) =>
                            void savePrefs({
                                ...prefsRef.current,
                                workoutReminderTime: normalizeTimeToHHMM(e.target.value),
                            })
                        }
                        className="min-w-0 flex-1 rounded-lg border border-amber-400/50 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-[#ff9d00]/40 dark:bg-black/50 dark:text-white"
                    />
                </div>
            ) : null}

            {message ? (
                <p className="px-1 text-center text-xs text-amber-800 dark:text-[#ffe066]/90">{message}</p>
            ) : null}
        </div>
    );
}
