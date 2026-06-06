'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { supabase } from '@auth/supabaseClient';
import {
    DEFAULT_AFTERNOON_SCORE_TIME,
    DEFAULT_EVENING_SCORE_TIME,
    DEFAULT_HABIT_REMINDER_TIMES,
    DEFAULT_MORNING_SCORE_TIME,
    DEFAULT_PLAN_TOMORROW_TIME,
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
    notifyMorningScoreEnabled: boolean;
    notifyAfternoonScoreEnabled: boolean;
    notifyEveningScoreEnabled: boolean;
    notifyPlanTomorrowEnabled: boolean;
    habitReminderTimes: string[];
    prioritiesReminderTimes: string[];
    todosReminderTimes: string[];
    morningScoreTime: string;
    afternoonScoreTime: string;
    eveningScoreTime: string;
    planTomorrowTime: string;
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

function ReminderTimeRow({
    time,
    onCommit,
    onRemove,
    removeDisabled,
    hideRemove,
    label,
    index,
}: {
    time: string;
    onCommit: (value: string) => void;
    onRemove: () => void;
    removeDisabled: boolean;
    hideRemove?: boolean;
    label: string;
    index: number;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const onCommitRef = useRef(onCommit);
    onCommitRef.current = onCommit;

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        const handleChange = () => {
            onCommitRef.current(normalizeTimeToHHMM(input.value));
        };

        input.addEventListener('change', handleChange);
        return () => input.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        const input = inputRef.current;
        if (input && document.activeElement !== input) {
            input.value = time;
        }
    }, [time]);

    return (
        <div className="flex items-center gap-2">
            <input
                ref={inputRef}
                type="time"
                defaultValue={time}
                className="min-w-0 flex-1 rounded-lg border border-amber-400/50 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-[#ff9d00]/40 dark:bg-black/50 dark:text-white"
            />
            {!hideRemove ? (
                <button
                    type="button"
                    disabled={removeDisabled}
                    onClick={onRemove}
                    className="shrink-0 rounded-lg border border-red-400/50 px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-950/40"
                    aria-label={`Remove ${label} time ${index + 1}`}
                >
                    Remove
                </button>
            ) : null}
        </div>
    );
}

function SingleTimeSlotEditor({
    label,
    description,
    enabled,
    onEnabledChange,
    time,
    onTimeCommit,
    rowShell,
    NeonToggle,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onEnabledChange: (on: boolean) => void;
    time: string;
    onTimeCommit: (time: string) => void;
    rowShell: (className?: string) => string;
    NeonToggle: Props['NeonToggle'];
}) {
    return (
        <div className="space-y-2">
            <div className={rowShell()}>
                <span className="flex-1 text-slate-800 dark:text-white">{label}</span>
                <NeonToggle checked={enabled} onChange={onEnabledChange} aria-label={`${label} notifications`} />
            </div>
            <p className="px-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
            {enabled ? (
                <div className={`${rowShell()} flex-col items-stretch gap-2`}>
                    <ReminderTimeRow
                        time={time}
                        label={label}
                        index={0}
                        onCommit={onTimeCommit}
                        onRemove={() => {}}
                        removeDisabled
                        hideRemove
                    />
                </div>
            ) : null}
        </div>
    );
}

function ReminderTimeEditor({
    label,
    description,
    enabled,
    onEnabledChange,
    times,
    onTimesCommit,
    saving,
    rowShell,
    NeonToggle,
}: {
    label: string;
    description: string;
    enabled: boolean;
    onEnabledChange: (on: boolean) => void;
    times: string[];
    onTimesCommit: (times: string[]) => void;
    saving: boolean;
    rowShell: (className?: string) => string;
    NeonToggle: Props['NeonToggle'];
}) {
    const [draftTimes, setDraftTimes] = useState(times);

    useEffect(() => {
        setDraftTimes(times);
    }, [times]);

    const commitDraft = (next: string[]) => {
        setDraftTimes(next);
        onTimesCommit(next);
    };

    const addTime = () => {
        if (draftTimes.length >= MAX_REMINDER_TIMES_PER_CATEGORY) return;
        commitDraft([...draftTimes, emptyTimeValue()]);
    };

    const removeTime = (index: number) => {
        commitDraft(draftTimes.filter((_, i) => i !== index));
    };

    const updateTime = (index: number, value: string) => {
        const next = [...draftTimes];
        next[index] = value;
        commitDraft(next);
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
                        Reminder times ({draftTimes.length}/{MAX_REMINDER_TIMES_PER_CATEGORY})
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tap a time to edit — your choice is saved when you tap the checkmark.
                    </p>
                    {draftTimes.length === 0 ? (
                        <p className="text-xs text-amber-800 dark:text-[#ffe066]/90">
                            Add at least one time to receive reminders.
                        </p>
                    ) : null}
                    {draftTimes.map((time, index) => (
                        <ReminderTimeRow
                            key={`${label}-time-${index}`}
                            time={time}
                            label={label}
                            index={index}
                            onCommit={(value) => updateTime(index, value)}
                            onRemove={() => removeTime(index)}
                            removeDisabled={saving}
                        />
                    ))}
                    <button
                        type="button"
                        disabled={saving || draftTimes.length >= MAX_REMINDER_TIMES_PER_CATEGORY}
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
        notifyMorningScoreEnabled: true,
        notifyAfternoonScoreEnabled: true,
        notifyEveningScoreEnabled: true,
        notifyPlanTomorrowEnabled: true,
        habitReminderTimes: [...DEFAULT_HABIT_REMINDER_TIMES],
        prioritiesReminderTimes: [...DEFAULT_PRIORITIES_REMINDER_TIMES],
        todosReminderTimes: [...DEFAULT_TODOS_REMINDER_TIMES],
        morningScoreTime: DEFAULT_MORNING_SCORE_TIME,
        afternoonScoreTime: DEFAULT_AFTERNOON_SCORE_TIME,
        eveningScoreTime: DEFAULT_EVENING_SCORE_TIME,
        planTomorrowTime: DEFAULT_PLAN_TOMORROW_TIME,
    });
    const prefsRef = useRef(prefs);
    prefsRef.current = prefs;

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
                    return false;
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
                    return false;
                }

                setPrefs(next);

                if (!pushEnabled) {
                    setMessage('Saved. Enable push notifications above to receive reminders.');
                } else {
                    setMessage('Reminder schedule saved.');
                }
                return true;
            } finally {
                setSaving(false);
            }
        },
        [pushEnabled]
    );

    const applyToggleChange = (patch: Partial<HabitReminderPrefsState>) => {
        const next = { ...prefs, ...patch };
        void savePrefs(next);
    };

    const applyTimesChange = useCallback(
        (
            key: 'habitReminderTimes' | 'prioritiesReminderTimes' | 'todosReminderTimes',
            times: string[]
        ) => {
            void savePrefs({ ...prefsRef.current, [key]: times });
        },
        [savePrefs]
    );

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
                onEnabledChange={(on) => applyToggleChange({ notifyHabitsEnabled: on })}
                times={prefs.habitReminderTimes}
                onTimesCommit={(habitReminderTimes) =>
                    applyTimesChange('habitReminderTimes', habitReminderTimes)
                }
                saving={saving}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <ReminderTimeEditor
                label="Priorities"
                description="Nudges you to set priorities, or finish open ones at each scheduled time."
                enabled={prefs.notifyPrioritiesEnabled}
                onEnabledChange={(on) => applyToggleChange({ notifyPrioritiesEnabled: on })}
                times={prefs.prioritiesReminderTimes}
                onTimesCommit={(prioritiesReminderTimes) =>
                    applyTimesChange('prioritiesReminderTimes', prioritiesReminderTimes)
                }
                saving={saving}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <ReminderTimeEditor
                label="To-do list"
                description="Prompts you to add a list or finish open to-dos at each scheduled time."
                enabled={prefs.notifyTodosEnabled}
                onEnabledChange={(on) => applyToggleChange({ notifyTodosEnabled: on })}
                times={prefs.todosReminderTimes}
                onTimesCommit={(todosReminderTimes) =>
                    applyTimesChange('todosReminderTimes', todosReminderTimes)
                }
                saving={saving}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <div className={`${rowShell()} mt-2 flex-col items-stretch gap-1`}>
                <p className="text-sm font-medium text-slate-800 dark:text-white">Score recaps</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Personal score summaries when each part of your day ends — with your name and stats.
                </p>
            </div>

            <SingleTimeSlotEditor
                label="Morning score"
                description="Sent when morning ends (default 12:00pm) with your morning habit score."
                enabled={prefs.notifyMorningScoreEnabled}
                onEnabledChange={(on) => applyToggleChange({ notifyMorningScoreEnabled: on })}
                time={prefs.morningScoreTime}
                onTimeCommit={(morningScoreTime) => {
                    const next = { ...prefsRef.current, morningScoreTime };
                    setPrefs(next);
                    void savePrefs(next);
                }}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <SingleTimeSlotEditor
                label="Afternoon score"
                description="Afternoon habit score recap (default 5:00pm)."
                enabled={prefs.notifyAfternoonScoreEnabled}
                onEnabledChange={(on) => applyToggleChange({ notifyAfternoonScoreEnabled: on })}
                time={prefs.afternoonScoreTime}
                onTimeCommit={(afternoonScoreTime) => {
                    const next = { ...prefsRef.current, afternoonScoreTime };
                    setPrefs(next);
                    void savePrefs(next);
                }}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <SingleTimeSlotEditor
                label="Evening score"
                description="Evening habit score recap (default 9:00pm)."
                enabled={prefs.notifyEveningScoreEnabled}
                onEnabledChange={(on) => applyToggleChange({ notifyEveningScoreEnabled: on })}
                time={prefs.eveningScoreTime}
                onTimeCommit={(eveningScoreTime) => {
                    const next = { ...prefsRef.current, eveningScoreTime };
                    setPrefs(next);
                    void savePrefs(next);
                }}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            <SingleTimeSlotEditor
                label="Plan tomorrow"
                description="End-of-day nudge to map tomorrow's priorities — intentional, not generic."
                enabled={prefs.notifyPlanTomorrowEnabled}
                onEnabledChange={(on) => applyToggleChange({ notifyPlanTomorrowEnabled: on })}
                time={prefs.planTomorrowTime}
                onTimeCommit={(planTomorrowTime) => {
                    const next = { ...prefsRef.current, planTomorrowTime };
                    setPrefs(next);
                    void savePrefs(next);
                }}
                rowShell={rowShell}
                NeonToggle={NeonToggle}
            />

            {message ? (
                <p className="px-1 text-center text-xs text-amber-800 dark:text-[#ffe066]/90">
                    {message}
                </p>
            ) : null}

            <HabitReminderDiagnosticsPanel pushEnabled={pushEnabled} />

            <HabitReminderTestButton className="px-1" />
        </>
    );
}

type Diagnostics = {
    pushSubscribed: boolean;
    habitsEnabled: boolean;
    habitReminderTimes: string[];
    timezone: string;
    localDate: string;
    localTime: string;
    activeHabitTimes: string[];
    incompleteHabitsCount: number;
    wouldSendHabitReminderNow: boolean;
    blockers: string[];
};

function HabitReminderDiagnosticsPanel({ pushEnabled }: { pushEnabled: boolean }) {
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
    const [runMessage, setRunMessage] = useState<string | null>(null);

    const loadDiagnostics = useCallback(async () => {
        setLoading(true);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const res = await fetch('/api/push/habit-reminders/diagnostics', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
                setDiagnostics((await res.json()) as Diagnostics);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDiagnostics();
    }, [loadDiagnostics, pushEnabled]);

    const runCheck = async (force: boolean) => {
        setRunning(true);
        setRunMessage(null);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setRunMessage('Please log in again.');
                return;
            }

            const res = await fetch('/api/push/habit-reminders/run', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ force, habitsOnly: force }),
            });
            const data = (await res.json()) as {
                message?: string;
                diagnostics?: Diagnostics;
            };
            if (data.diagnostics) setDiagnostics(data.diagnostics);
            setRunMessage(data.message || 'Check complete.');
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="space-y-2 px-1">
            <button
                type="button"
                disabled={loading}
                onClick={() => void loadDiagnostics()}
                className="w-full rounded-lg border border-slate-300/80 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-black/30 dark:text-slate-400"
            >
                {loading ? 'Checking schedule…' : 'Refresh schedule status'}
            </button>

            {diagnostics ? (
                <div className="rounded-lg border border-amber-400/40 bg-amber-50/50 p-3 text-xs text-slate-700 dark:border-[#ff9d00]/30 dark:bg-black/30 dark:text-slate-300">
                    <p>
                        Local time: <strong>{diagnostics.localTime}</strong> ({diagnostics.timezone})
                    </p>
                    <p>
                        Scheduled habit times:{' '}
                        <strong>{diagnostics.habitReminderTimes.join(', ') || 'none'}</strong>
                    </p>
                    <p>
                        Incomplete habits today: <strong>{diagnostics.incompleteHabitsCount}</strong>
                    </p>
                    <p>
                        Would send now:{' '}
                        <strong>{diagnostics.wouldSendHabitReminderNow ? 'Yes' : 'No'}</strong>
                    </p>
                    {diagnostics.blockers.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-900 dark:text-[#ffe066]/90">
                            {diagnostics.blockers.map((b) => (
                                <li key={b}>{b}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}

            <button
                type="button"
                disabled={running}
                onClick={() => void runCheck(false)}
                className="w-full rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-[#ff9d00]/50 dark:bg-black/40 dark:text-[#ffe066] dark:hover:bg-[#ff9d00]/10"
            >
                {running ? 'Running…' : 'Run scheduled check now'}
            </button>
            <button
                type="button"
                disabled={running}
                onClick={() => void runCheck(true)}
                className="w-full rounded-lg border border-slate-300/80 bg-white/80 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-black/30 dark:text-slate-400"
            >
                Send habit reminder now (ignore schedule)
            </button>
            {runMessage ? (
                <p className="text-center text-xs text-amber-800 dark:text-[#ffe066]/90">{runMessage}</p>
            ) : null}
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Scheduled reminders are checked every 10 minutes in the background.
            </p>
        </div>
    );
}
