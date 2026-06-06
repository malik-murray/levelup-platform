'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { supabase } from '@auth/supabaseClient';
import {
    DEFAULT_HABIT_REMINDER_TIMES,
    DEFAULT_PRIORITIES_REMINDER_TIMES,
    DEFAULT_TODOS_REMINDER_TIMES,
    MAX_REMINDER_TIMES_PER_CATEGORY,
    normalizeTimeToHHMM,
} from '@/lib/habit/habitReminderUtils';
import { HabitReminderTestButton } from '@/components/HabitReminderTestButton';

type HabitReminderPrefsState = {
    notifyHabitsEnabled: boolean;
    notifyPrioritiesEnabled: boolean;
    notifyTodosEnabled: boolean;
    habitReminderTimes: string[];
    prioritiesReminderTimes: string[];
    todosReminderTimes: string[];
};

type Props = {
    pushEnabled: boolean;
    rowShell: (className?: string) => string;
    NeonToggle: ComponentType<{
        checked: boolean;
        onChange: (v: boolean) => void;
        id?: string;
        'aria-label'?: string;
    }>;
};

function emptyTimeValue(): string {
    return '08:00';
}

function ReminderTimeEditor({
    label,
    description,
    enabled,
    onEnabledChange,
    times,
    onTimesChange,
    disabled,
    rowShell,
    NeonToggle,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onEnabledChange: (on: boolean) => void;
    times: string[];
    onTimesChange: (times: string[]) => void;
    disabled: boolean;
    rowShell: (className?: string) => string;
    NeonToggle: Props['NeonToggle'];
}) {
    const addTime = () => {
        if (times.length >= MAX_REMINDER_TIMES_PER_CATEGORY) return;
        onTimesChange([...times, emptyTimeValue()]);
    };

    const removeTime = (index: number) => {
        onTimesChange(times.filter((_, i) => i !== index));
    };

    const updateTime = (index: number, value: string) => {
        const next = [...times];
        next[index] = normalizeTimeToHHMM(value);
        onTimesChange(next);
    };

    return (
        <div className="space-y-2">
            <div className={rowShell()}>
                <span className="flex-1 text-slate-800 dark:text-white">{label}</span>
                <NeonToggle
                    checked={enabled}
                    onChange={onEnabledChange}
                    aria-label={`${label} notifications`}
                />
            </div>
            <p className="px-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>

            {enabled ? (
                <div className={`${rowShell()} flex-col items-stretch gap-2`}>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Reminder times ({times.length}/{MAX_REMINDER_TIMES_PER_CATEGORY})
                    </p>
                    {times.length === 0 ? (
                        <p className="text-xs text-amber-800 dark:text-[#ffe066]/90">
                            Add at least one time to receive reminders.
                        </p>
                    ) : null}
                    {times.map((time, index) => (
                        <div key={`${label}-${index}`} className="flex items-center gap-2">
                            <input
                                type="time"
                                value={time}
                                disabled={disabled}
                                onChange={(e) => updateTime(index, e.target.value)}
                                className="min-w-0 flex-1 rounded-lg border border-amber-400/50 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-[#ff9d00]/40 dark:bg-black/50 dark:text-white"
                            />
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => removeTime(index)}
                                className="shrink-0 rounded-lg border border-red-400/50 px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/40"
                                aria-label={`Remove ${label} time ${index + 1}`}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        disabled={disabled || times.length >= MAX_REMINDER_TIMES_PER_CATEGORY}
                        onClick={addTime}
                        className="rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-[#ff9d00]/50 dark:text-[#ffe066] dark:hover:bg-[#ff9d00]/10"
                    >
                        + Add reminder time
                    </button>
                </div>
            ) : null}
        </div>
    );
}

export function HabitReminderSettings({ pushEnabled, rowShell, NeonToggle }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [prefs, setPrefs] = useState<HabitReminderPrefsState>({
        notifyHabitsEnabled: true,
        notifyPrioritiesEnabled: true,
        notifyTodosEnabled: true,
        habitReminderTimes: [...DEFAULT_HABIT_REMINDER_TIMES],
        prioritiesReminderTimes: [...DEFAULT_PRIORITIES_REMINDER_TIMES],
        todosReminderTimes: [...DEFAULT_TODOS_REMINDER_TIMES],
    });

    useEffect(() => {
        const load = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const res = await fetch('/api/push/habit-preferences', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (res.ok) {
                    const data = (await res.json()) as HabitReminderPrefsState;
                    setPrefs(data);
                }
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const savePrefs = useCallback(
        async (next: HabitReminderPrefsState) => {
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

                const res = await fetch('/api/push/habit-preferences', {
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
                    setMessage(err.error || 'Could not save habit reminder settings.');
                    return;
                }

                if (!pushEnabled) {
                    setMessage('Saved. Enable push notifications above to receive reminders.');
                } else {
                    setMessage('Reminder schedule saved.');
                }
            } finally {
                setSaving(false);
            }
        },
        [pushEnabled]
    );

    const applyChange = (patch: Partial<HabitReminderPrefsState>) => {
        const next = { ...prefs, ...patch };
        setPrefs(next);
        void savePrefs(next);
    };

    if (loading) {
        return (
            <p className="px-1 text-center text-xs text-slate-500 dark:text-slate-400">
                Loading habit reminder settings…
            </p>
        );
    }

    return (
        <>
            <div className={`${rowShell()} mt-2 flex-col items-stretch gap-1`}>
                <p className="text-sm font-medium text-slate-800 dark:text-white">Habit reminders</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose which categories notify you, set custom times, and add multiple reminders per
                    category. Uses your device timezone.
                </p>
            </div>

            <ReminderTimeEditor
                label="Habits"
                description="Reminds you to check in on habits you have not completed yet."
                enabled={prefs.notifyHabitsEnabled}
                onEnabledChange={(on) => applyChange({ notifyHabitsEnabled: on })}
                times={prefs.habitReminderTimes}
                onTimesChange={(habitReminderTimes) => applyChange({ habitReminderTimes })}
                disabled={saving}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <ReminderTimeEditor
                label="Priorities"
                description="Nudges you to set priorities, or finish open ones at each scheduled time."
                enabled={prefs.notifyPrioritiesEnabled}
                onEnabledChange={(on) => applyChange({ notifyPrioritiesEnabled: on })}
                times={prefs.prioritiesReminderTimes}
                onTimesChange={(prioritiesReminderTimes) => applyChange({ prioritiesReminderTimes })}
                disabled={saving}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <ReminderTimeEditor
                label="To-do list"
                description="Prompts you to add a list or finish open to-dos at each scheduled time."
                enabled={prefs.notifyTodosEnabled}
                onEnabledChange={(on) => applyChange({ notifyTodosEnabled: on })}
                times={prefs.todosReminderTimes}
                onTimesChange={(todosReminderTimes) => applyChange({ todosReminderTimes })}
                disabled={saving}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            {message ? (
                <p className="px-1 text-center text-xs text-amber-800 dark:text-[#ffe066]/90">
                    {message}
                </p>
            ) : null}

            <HabitReminderTestButton className="px-1" />
        </>
    );
}
