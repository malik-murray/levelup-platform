'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type {
    WorkoutSessionWithItems,
    WorkoutSessionItem,
    PreviousWorkoutPerformanceItem,
    SessionAdaptiveUpdate,
} from '@/lib/fitness/workoutSessions';
import {
    getSessionWithItems,
    completeWorkoutSession,
    abandonWorkoutSession,
    updateWorkoutSessionItemActuals,
    getPreviousLoggedPerformanceForExercises,
    getExecutionAdaptiveInsightsForUser,
} from '@/lib/fitness/workoutSessions';
import { getExerciseNamesBySlugs, formatSlugAsTitle } from '@/lib/fitness/exercises';
import { getWorkoutPlanName } from '@/lib/fitness/workoutPlans';
import { getProgramScheduleEntryById } from '@/lib/fitness/programEngine';

type SessionDetailClientProps = {
    id: string;
};

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function SessionDetailClient({ id }: SessionDetailClientProps) {
    const [session, setSession] = useState<WorkoutSessionWithItems | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);
    const [abandoning, setAbandoning] = useState(false);
    const [itemEdits, setItemEdits] = useState<Record<string, {
        actual_sets: string;
        actual_reps: string;
        actual_notes: string;
        saveError?: string;
        saveSuccess?: string;
        saving?: boolean;
    }>>({});
    const [previousByExercise, setPreviousByExercise] = useState<
        Record<string, PreviousWorkoutPerformanceItem | null>
    >({});
    const [exerciseNames, setExerciseNames] = useState<Record<string, string>>({});
    const [sourcePlanName, setSourcePlanName] = useState<string | null>(null);
    const [restTimerInitialSeconds, setRestTimerInitialSeconds] = useState(60);
    const [restTimerRemainingSeconds, setRestTimerRemainingSeconds] = useState(60);
    const [restTimerRunning, setRestTimerRunning] = useState(false);
    const [restTimerSourceItemId, setRestTimerSourceItemId] = useState<string | null>(null);
    const [adaptiveUpdate, setAdaptiveUpdate] = useState<SessionAdaptiveUpdate | null>(null);
    const [adaptiveInsights, setAdaptiveInsights] = useState<{
        expectedDaysPerWeek: number;
        completedDaysThisWeek: number;
        missedDaysThisWeek: number;
        recentAverageCompletionRate: number;
        suggestions: string[];
    } | null>(null);
    const [scheduledInfo, setScheduledInfo] = useState<{ scheduled_date: string; day_index: number } | null>(null);

    const formatCountdown = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const parseNumberOrNull = (v: string): number | null =>
        v.trim() === '' ? null : Number(v);

    const saveItemActuals = async (
        itemId: string,
        edit: { actual_sets: string; actual_reps: string; actual_notes: string },
        successMessage = 'Saved.'
    ) => {
        const actual_sets = parseNumberOrNull(edit.actual_sets);
        const actual_reps = parseNumberOrNull(edit.actual_reps);

        setItemEdits((prev) => ({
            ...prev,
            [itemId]: {
                ...edit,
                saving: true,
                saveError: undefined,
                saveSuccess: undefined,
            },
        }));
        try {
            const updated = await updateWorkoutSessionItemActuals(
                itemId,
                {
                    actual_sets,
                    actual_reps,
                    actual_notes: edit.actual_notes.trim() || null,
                },
                supabase
            );
            setSession((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    items: prev.items.map((it) =>
                        it.id === updated.id ? (updated as WorkoutSessionItem) : it
                    ),
                };
            });
            setItemEdits((prev) => ({
                ...prev,
                [itemId]: {
                    ...prev[itemId],
                    actual_sets:
                        updated.actual_sets_completed != null
                            ? String(updated.actual_sets_completed)
                            : '',
                    actual_reps:
                        updated.actual_avg_reps_per_set != null
                            ? String(updated.actual_avg_reps_per_set)
                            : '',
                    actual_notes: updated.actual_notes ?? '',
                    saving: false,
                    saveSuccess: successMessage,
                    saveError: undefined,
                },
            }));
        } catch (e) {
            console.error('Save item actuals error:', e);
            setItemEdits((prev) => ({
                ...prev,
                [itemId]: {
                    ...prev[itemId],
                    saving: false,
                    saveError:
                        e instanceof Error
                            ? e.message
                            : 'Failed to save actual performance',
                },
            }));
        }
    };

    const startRestTimer = (seconds: number, itemId?: string) => {
        const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 60;
        setRestTimerInitialSeconds(safeSeconds);
        setRestTimerRemainingSeconds(safeSeconds);
        setRestTimerRunning(true);
        setRestTimerSourceItemId(itemId ?? null);
    };

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setError(null);
            setSession(undefined);
            try {
                const {
                    data: { user },
                    error: authError,
                } = await supabase.auth.getUser();
                if (authError || !user) {
                    window.location.href = '/login';
                    return;
                }

                const data = await getSessionWithItems(id, supabase);
                if (cancelled) return;
                setSession(data);
                if (data?.items?.length) {
                    const slugs = [...new Set(data.items.map((i) => i.exercise_slug))];
                    const names = await getExerciseNamesBySlugs(slugs, supabase);
                    if (!cancelled) setExerciseNames(names);
                } else {
                    setExerciseNames({});
                }
                if (data?.plan_id) {
                    try {
                        const name = await getWorkoutPlanName(data.plan_id, supabase);
                        if (!cancelled) setSourcePlanName(name);
                    } catch (e) {
                        console.error('Error loading source plan name:', e);
                        if (!cancelled) setSourcePlanName(null);
                    }
                } else {
                    setSourcePlanName(null);
                }
                if (data?.program_schedule_id) {
                    try {
                        const sched = await getProgramScheduleEntryById(data.program_schedule_id, supabase);
                        if (!cancelled && sched) {
                            setScheduledInfo({
                                scheduled_date: sched.scheduled_date,
                                day_index: sched.day_index,
                            });
                        }
                    } catch {
                        if (!cancelled) setScheduledInfo(null);
                    }
                } else {
                    setScheduledInfo(null);
                }
                if (data && data.items) {
                    const initial: typeof itemEdits = {};
                    data.items.forEach((item) => {
                        initial[item.id] = {
                            actual_sets: item.actual_sets_completed != null ? String(item.actual_sets_completed) : '',
                            actual_reps: item.actual_avg_reps_per_set != null ? String(item.actual_avg_reps_per_set) : '',
                            actual_notes: item.actual_notes ?? '',
                        };
                    });
                    setItemEdits(initial);

                    const uniqueExerciseSlugs = Array.from(
                        new Set(data.items.map((i) => i.exercise_slug))
                    );
                    if (uniqueExerciseSlugs.length > 0) {
                        try {
                            const prev = await getPreviousLoggedPerformanceForExercises(
                                user.id,
                                data.id,
                                uniqueExerciseSlugs,
                                supabase
                            );
                            if (!cancelled) {
                                setPreviousByExercise(prev);
                            }
                        } catch (e) {
                            console.error('Error loading previous performance:', e);
                        }
                    }
                }
                if (data) {
                    try {
                        const insights = await getExecutionAdaptiveInsightsForUser(data.user_id, supabase);
                        if (!cancelled) setAdaptiveInsights(insights);
                    } catch {
                        if (!cancelled) setAdaptiveInsights(null);
                    }
                }
            } catch (e) {
                console.error('Error loading workout session detail:', e);
                if (cancelled) return;
                setError(e instanceof Error ? e.message : 'Failed to load session');
                setSession(null);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    useEffect(() => {
        if (!restTimerRunning) return;
        if (restTimerRemainingSeconds <= 0) {
            setRestTimerRunning(false);
            return;
        }
        const interval = window.setInterval(() => {
            setRestTimerRemainingSeconds((prev) => {
                if (prev <= 1) {
                    window.clearInterval(interval);
                    setRestTimerRunning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => window.clearInterval(interval);
    }, [restTimerRunning, restTimerRemainingSeconds]);

    if (session === undefined && !error) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/sessions"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Sessions
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading session…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/sessions"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Sessions
                </Link>
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            </div>
        );
    }

    if (session === null) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/sessions"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Sessions
                </Link>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Session not found or you do not have access to it.
                </div>
            </div>
        );
    }

    // Extra narrowing for TypeScript (we handled `session === null` above).
    if (!session) return null;

    const itemCount = session.items.length;

    const totalItems = itemCount;
    const itemsWithActuals = session.items.reduce((count, item) => {
        const hasSets = item.actual_sets_completed != null;
        const hasReps = item.actual_avg_reps_per_set != null;
        const hasNotes = !!item.actual_notes && item.actual_notes.trim().length > 0;
        return count + (hasSets || hasReps || hasNotes ? 1 : 0);
    }, 0);
    const completionRate =
        totalItems === 0 ? 0 : Math.round((itemsWithActuals / totalItems) * 100);
    const totalActualSets = session.items.reduce(
        (sum, item) => sum + (item.actual_sets_completed ?? 0),
        0
    );
    const itemsWithNotes = session.items.reduce(
        (count, item) =>
            count + (!!item.actual_notes && item.actual_notes.trim().length > 0 ? 1 : 0),
        0
    );

    let helperLine = 'No actual performance logged yet.';
    if (itemsWithActuals > 0 && itemsWithActuals < totalItems) {
        helperLine = "You've logged part of this workout.";
    } else if (totalItems > 0 && itemsWithActuals === totalItems) {
        helperLine = "You've logged every exercise in this session.";
    }
    const restTimerSourceItem =
        restTimerSourceItemId != null
            ? session.items.find((it) => it.id === restTimerSourceItemId) ?? null
            : null;
    const restTimerSourceName = restTimerSourceItem
        ? exerciseNames[restTimerSourceItem.exercise_slug] ??
          formatSlugAsTitle(restTimerSourceItem.exercise_slug)
        : null;

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <Link
                    href="/fitness/sessions"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Sessions
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {session.name || 'Workout Session'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span
                        className={`rounded-full px-2 py-1 font-medium ${
                            session.status === 'completed'
                                ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : session.status === 'abandoned'
                                ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                    >
                        Status: {session.status}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Items: {itemCount}
                    </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Started: {formatDateTime(session.started_at)}{' '}
                    {session.ended_at && <>• Ended: {formatDateTime(session.ended_at)}</>}
                </p>
                {session.plan_id && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Source plan:{' '}
                        <Link
                            href={`/fitness/plans/${session.plan_id}`}
                            className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 underline underline-offset-1"
                        >
                            {sourcePlanName ?? 'View plan'}
                        </Link>
                    </p>
                )}
                {scheduledInfo && (
                    <p className="mt-1 text-[11px] text-indigo-300">
                        Scheduled session • Day {scheduledInfo.day_index} • {new Date(`${scheduledInfo.scheduled_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                )}
                {session.notes && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {session.notes}
                    </p>
                )}
                {session.status === 'in_progress' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <button
                            type="button"
                            disabled={completing}
                            onClick={async () => {
                                setActionError(null);
                                try {
                                    setCompleting(true);
                                    const result = await completeWorkoutSession(session.id, supabase);
                                    setSession({ ...session, ...result.session });
                                    setAdaptiveUpdate(result.adaptation);
                                } catch (e) {
                                    console.error('Complete session error:', e);
                                    setActionError(
                                        e instanceof Error ? e.message : 'Failed to mark session as completed'
                                    );
                                } finally {
                                    setCompleting(false);
                                }
                            }}
                            className="inline-flex items-center rounded-md bg-emerald-500 px-3 py-1 font-medium text-black hover:bg-emerald-400 disabled:opacity-60 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
                        >
                            {completing ? 'Marking…' : 'Mark completed'}
                        </button>
                        <button
                            type="button"
                            disabled={abandoning}
                            onClick={async () => {
                                setActionError(null);
                                try {
                                    setAbandoning(true);
                                    const updated = await abandonWorkoutSession(session.id, supabase);
                                    setSession({ ...session, ...updated });
                                } catch (e) {
                                    console.error('Abandon session error:', e);
                                    setActionError(
                                        e instanceof Error ? e.message : 'Failed to abandon session'
                                    );
                                } finally {
                                    setAbandoning(false);
                                }
                            }}
                            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            {abandoning ? 'Updating…' : 'Abandon session'}
                        </button>
                    </div>
                )}
                {actionError && (
                    <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
                        {actionError}
                    </p>
                )}
                {adaptiveUpdate && (
                    <div className={`mt-2 rounded-md border px-3 py-2 text-[11px] ${
                        adaptiveUpdate.applied
                            ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                            : 'border-slate-600 bg-slate-900/60 text-slate-300'
                    }`}>
                        <p className="font-medium">
                            {adaptiveUpdate.applied ? 'Adaptive update applied' : 'Adaptive update not required'}
                        </p>
                        <p className="mt-0.5">{adaptiveUpdate.reason}</p>
                        {adaptiveUpdate.suggestions.length > 0 && (
                            <ul className="mt-1 list-disc list-inside space-y-0.5">
                                {adaptiveUpdate.suggestions.slice(0, 2).map((s, idx) => (
                                    <li key={`${s}-${idx}`}>{s}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </header>

            <section className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                    Session summary
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                        <span className="font-semibold">Exercises:</span> {totalItems}
                    </span>
                    <span>
                        <span className="font-semibold">Logged items:</span> {itemsWithActuals} / {totalItems}
                    </span>
                    <span>
                        <span className="font-semibold">Completion:</span> {completionRate}%
                    </span>
                    <span>
                        <span className="font-semibold">Total sets completed:</span> {totalActualSets}
                    </span>
                    <span>
                        <span className="font-semibold">Notes added:</span> {itemsWithNotes}
                    </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {helperLine}
                </p>
            </section>

            {adaptiveInsights && (
                <section className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                        Adherence & adaptive guidance
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span><span className="font-semibold">Expected days/week:</span> {adaptiveInsights.expectedDaysPerWeek}</span>
                        <span><span className="font-semibold">Completed days (7d):</span> {adaptiveInsights.completedDaysThisWeek}</span>
                        <span><span className="font-semibold">Missed days (7d):</span> {adaptiveInsights.missedDaysThisWeek}</span>
                        <span><span className="font-semibold">Avg completion:</span> {adaptiveInsights.recentAverageCompletionRate}%</span>
                    </div>
                    <ul className="mt-1 list-disc list-inside text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        {adaptiveInsights.suggestions.map((s, idx) => (
                            <li key={`${s}-${idx}`}>{s}</li>
                        ))}
                    </ul>
                </section>
            )}

            {session.status === 'in_progress' && (
                <section className="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                        Rest timer
                    </h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {formatCountdown(restTimerRemainingSeconds)}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setRestTimerRunning(true)}
                                disabled={restTimerRemainingSeconds <= 0}
                                className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1 font-medium text-black hover:bg-amber-400 disabled:opacity-60 dark:bg-amber-400 dark:hover:bg-amber-300"
                            >
                                Start
                            </button>
                            <button
                                type="button"
                                onClick={() => setRestTimerRunning(false)}
                                className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                Stop
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRestTimerRunning(false);
                                    setRestTimerRemainingSeconds(restTimerInitialSeconds);
                                }}
                                className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                Reset
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setRestTimerRemainingSeconds((prev) => prev + 15)
                                }
                                className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                +15 sec
                            </button>
                        </div>
                    </div>
                    {restTimerSourceName && (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Started from: {restTimerSourceName}
                        </p>
                    )}
                </section>
            )}

            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Session items
                </h2>
                {itemCount === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        This session has no items.
                    </p>
                ) : (
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800 dark:text-slate-100">
                        {session.items.map((item) => {
                            const edit = itemEdits[item.id] || {
                                actual_sets: '',
                                actual_reps: '',
                                actual_notes: '',
                            };
                            const canEdit = session.status === 'in_progress';
                            return (
                                <li key={item.id}>
                                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <Link
                                                href={`/fitness/exercises/${encodeURIComponent(item.exercise_slug)}`}
                                                className="font-semibold text-slate-900 hover:text-amber-600 dark:text-white dark:hover:text-amber-300"
                                            >
                                                {exerciseNames[item.exercise_slug] ?? formatSlugAsTitle(item.exercise_slug)}
                                            </Link>
                                            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                                <span>
                                                    <span className="font-semibold">Sets:</span> {item.target_sets}
                                                </span>
                                                <span>
                                                    <span className="font-semibold">Reps:</span> {item.target_rep_range}
                                                </span>
                                                <span>
                                                    <span className="font-semibold">Rest:</span> {item.target_rest_seconds} sec
                                                </span>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            startRestTimer(
                                                                item.target_rest_seconds || 60,
                                                                item.id
                                                            )
                                                        }
                                                        className="rounded border border-amber-500 px-2 py-0.5 font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-950/40"
                                                    >
                                                        Start rest
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                            {item.target_movement_pattern && (
                                                <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                    Pattern: {item.target_movement_pattern}
                                                </span>
                                            )}
                                            {item.target_mechanic && (
                                                <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                    Mechanic: {item.target_mechanic}
                                                </span>
                                            )}
                                        </div>
                                        {item.target_note && (
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                <span className="font-medium">Plan note:</span> {item.target_note}
                                            </p>
                                        )}
                                        <div className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                            <p className="mb-1 font-semibold">
                                                Actual performance
                                            </p>
                                            {canEdit ? (
                                                <>
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-slate-500 dark:text-slate-400">
                                                                Set tracker
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    disabled={!!edit.saving}
                                                                    onClick={() => {
                                                                        const current = Number(
                                                                            edit.actual_sets || '0'
                                                                        );
                                                                        const nextSets = Math.max(
                                                                            0,
                                                                            Number.isNaN(current)
                                                                                ? 0
                                                                                : current - 1
                                                                        );
                                                                        const nextEdit = {
                                                                            ...edit,
                                                                            actual_sets: String(nextSets),
                                                                        };
                                                                        setItemEdits((prev) => ({
                                                                            ...prev,
                                                                            [item.id]: {
                                                                                ...nextEdit,
                                                                                saveError: undefined,
                                                                                saveSuccess: undefined,
                                                                            },
                                                                        }));
                                                                        void saveItemActuals(
                                                                            item.id,
                                                                            nextEdit,
                                                                            'Set count updated.'
                                                                        );
                                                                    }}
                                                                    className="h-7 w-7 rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="min-w-7 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                                    {edit.actual_sets.trim() === ''
                                                                        ? '0'
                                                                        : edit.actual_sets}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    disabled={!!edit.saving}
                                                                    onClick={() => {
                                                                        const current = Number(
                                                                            edit.actual_sets || '0'
                                                                        );
                                                                        const nextSets =
                                                                            (Number.isNaN(current)
                                                                                ? 0
                                                                                : current) + 1;
                                                                        const nextEdit = {
                                                                            ...edit,
                                                                            actual_sets: String(nextSets),
                                                                        };
                                                                        setItemEdits((prev) => ({
                                                                            ...prev,
                                                                            [item.id]: {
                                                                                ...nextEdit,
                                                                                saveError: undefined,
                                                                                saveSuccess: undefined,
                                                                            },
                                                                        }));
                                                                        void saveItemActuals(
                                                                            item.id,
                                                                            nextEdit,
                                                                            'Set count updated.'
                                                                        );
                                                                        startRestTimer(
                                                                            item.target_rest_seconds || 60,
                                                                            item.id
                                                                        );
                                                                    }}
                                                                    className="h-7 w-7 rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <label className="flex flex-col gap-0.5">
                                                            <span className="text-slate-500 dark:text-slate-400">Sets completed</span>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={edit.actual_sets}
                                                                onChange={(e) =>
                                                                    setItemEdits((prev) => ({
                                                                        ...prev,
                                                                        [item.id]: {
                                                                            ...edit,
                                                                            actual_sets: e.target.value,
                                                                            saveError: undefined,
                                                                            saveSuccess: undefined,
                                                                        },
                                                                    }))
                                                                }
                                                                className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                            />
                                                        </label>
                                                        <label className="flex flex-col gap-0.5">
                                                            <span className="text-slate-500 dark:text-slate-400">Avg reps / set</span>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={edit.actual_reps}
                                                                onChange={(e) =>
                                                                    setItemEdits((prev) => ({
                                                                        ...prev,
                                                                        [item.id]: {
                                                                            ...edit,
                                                                            actual_reps: e.target.value,
                                                                            saveError: undefined,
                                                                            saveSuccess: undefined,
                                                                        },
                                                                    }))
                                                                }
                                                                className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                            />
                                                        </label>
                                                    </div>
                                                    <label className="flex flex-col gap-0.5 mb-2">
                                                        <span className="text-slate-500 dark:text-slate-400">Notes</span>
                                                        <textarea
                                                            rows={2}
                                                            value={edit.actual_notes}
                                                            onChange={(e) =>
                                                                setItemEdits((prev) => ({
                                                                    ...prev,
                                                                    [item.id]: {
                                                                        ...edit,
                                                                        actual_notes: e.target.value,
                                                                        saveError: undefined,
                                                                        saveSuccess: undefined,
                                                                    },
                                                                }))
                                                            }
                                                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        disabled={!!edit.saving}
                                                        onClick={async () => {
                                                            await saveItemActuals(item.id, edit, 'Saved.');
                                                        }}
                                                        className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                                                    >
                                                        {edit.saving ? 'Saving…' : 'Save actuals'}
                                                    </button>
                                                    {edit.saveError && (
                                                        <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
                                                            {edit.saveError}
                                                        </p>
                                                    )}
                                                    {edit.saveSuccess && (
                                                        <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                                            {edit.saveSuccess}
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.actual_sets_completed != null && (
                                                            <span>
                                                                <span className="font-semibold">Sets completed:</span>{' '}
                                                                {item.actual_sets_completed}
                                                            </span>
                                                        )}
                                                        {item.actual_avg_reps_per_set != null && (
                                                            <span>
                                                                <span className="font-semibold">Avg reps / set:</span>{' '}
                                                                {item.actual_avg_reps_per_set}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.actual_notes && (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Notes: {item.actual_notes}
                                                        </p>
                                                    )}
                                                    {item.actual_sets_completed == null &&
                                                        item.actual_avg_reps_per_set == null &&
                                                        !item.actual_notes && (
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                No actual performance recorded.
                                                            </p>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 border-t border-dashed border-slate-200 pt-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                            <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">
                                                Previous performance
                                            </p>
                                            {previousByExercise[item.exercise_slug] ? (
                                                (() => {
                                                    const prev = previousByExercise[item.exercise_slug]!;
                                                    const when =
                                                        prev.session_ended_at || prev.session_started_at;
                                                    return (
                                                        <div className="space-y-1">
                                                            {when && (
                                                                <p>
                                                                    <span className="font-semibold">Date:</span>{' '}
                                                                    {formatDateTime(when)}
                                                                </p>
                                                            )}
                                                            <div className="flex flex-wrap gap-2">
                                                                {prev.actual_sets_completed != null && (
                                                                    <span>
                                                                        <span className="font-semibold">
                                                                            Sets completed:
                                                                        </span>{' '}
                                                                        {prev.actual_sets_completed}
                                                                    </span>
                                                                )}
                                                                {prev.actual_avg_reps_per_set != null && (
                                                                    <span>
                                                                        <span className="font-semibold">
                                                                            Avg reps / set:
                                                                        </span>{' '}
                                                                        {prev.actual_avg_reps_per_set}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {prev.actual_notes && (
                                                                <p>
                                                                    <span className="font-semibold">Notes:</span>{' '}
                                                                    {prev.actual_notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                    No prior logged performance.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </section>
        </div>
    );
}

