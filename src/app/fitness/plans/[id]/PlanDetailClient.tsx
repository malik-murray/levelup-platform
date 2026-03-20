'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type { WorkoutPlanWithItems } from '@/lib/fitness/workoutPlans';
import { getWorkoutPlanWithItems, updateWorkoutPlanMeta, deleteWorkoutPlan } from '@/lib/fitness/workoutPlans';
import { createSessionFromPlan } from '@/lib/fitness/workoutSessions';

type PlanDetailClientProps = {
    id: string;
};

function formatDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export default function PlanDetailClient({ id }: PlanDetailClientProps) {
    const [plan, setPlan] = useState<WorkoutPlanWithItems | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [startingSession, setStartingSession] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setError(null);
            setPlan(undefined);
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    window.location.href = '/login';
                    return;
                }

                const data = await getWorkoutPlanWithItems(id, supabase);
                if (cancelled) return;
                setPlan(data);
            } catch (e) {
                console.error('Error loading workout plan detail:', e);
                if (cancelled) return;
                setError(e instanceof Error ? e.message : 'Failed to load workout plan');
                setPlan(null);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (plan === undefined && !error) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading plan…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            </div>
        );
    }

    if (plan === null) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Plan not found or you do not have access to it.
                </div>
            </div>
        );
    }

    // Extra narrowing for TypeScript (we handled `plan === undefined` and `plan === null` above).
    if (!plan) return null;

    // At this point `plan` is guaranteed to be loaded (we returned for `plan === null` and `plan === undefined` above).
    const itemCount = plan!.items.length;
    const musclesParam =
        plan!.muscle_slugs.length > 0
            ? `muscles=${encodeURIComponent(plan!.muscle_slugs.join(','))}`
            : '';
    const difficultyParam = plan!.difficulty
        ? `difficulty=${encodeURIComponent(plan!.difficulty)}`
        : '';
    const defaultCount = 5;
    const countParam =
        itemCount && itemCount !== defaultCount ? `count=${itemCount}` : '';
    const generatorParams = [musclesParam, difficultyParam, countParam].filter(Boolean).join('&');
    const generatorHref = generatorParams
        ? `/fitness/workout-generator?${generatorParams}`
        : '/fitness/workout-generator';

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {editMode ? (
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    ) : (
                        plan.name
                    )}
                </h1>
                {editMode ? (
                    <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        placeholder="Optional description of how or when to use this plan."
                        className="w-full max-w-xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                ) : (
                    plan.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {plan.description}
                        </p>
                    )
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    {plan.muscle_slugs.length > 0 && (
                        <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            Muscles: {plan.muscle_slugs.join(', ')}
                        </span>
                    )}
                    {plan.difficulty && (
                        <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            Difficulty: {plan.difficulty}
                        </span>
                    )}
                    <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Items: {itemCount}
                    </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Created: {formatDate(plan.created_at)} • Updated: {formatDate(plan.updated_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {!editMode && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditName(plan.name);
                                setEditDescription(plan.description ?? '');
                                setSaveMessage(null);
                                setError(null);
                                setEditMode(true);
                            }}
                            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Edit plan
                        </button>
                    )}
                    {editMode && (
                        <>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={async () => {
                                    setSaveMessage(null);
                                    const trimmedName = editName.trim();
                                    if (!trimmedName) {
                                        setError('Plan name is required.');
                                        return;
                                    }
                                    try {
                                        setSaving(true);
                                        const updated = await updateWorkoutPlanMeta(
                                            plan.id,
                                            {
                                                name: trimmedName,
                                                description: editDescription,
                                            },
                                            supabase
                                        );
                                        setPlan({ ...plan, ...updated });
                                        setSaveMessage('Plan details updated.');
                                        setError(null);
                                        setEditMode(false);
                                    } catch (e) {
                                        console.error('Update plan meta error:', e);
                                        setError(
                                            e instanceof Error ? e.message : 'Failed to update plan'
                                        );
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                className="inline-flex items-center rounded-md bg-amber-500 px-3 py-1 font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300 disabled:opacity-60"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditMode(false);
                                    setError(null);
                                    setSaveMessage(null);
                                }}
                                className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-1 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        disabled={deleting}
                        onClick={async () => {
                            const confirmed = window.confirm(
                                'Delete this plan? This cannot be undone.'
                            );
                            if (!confirmed) return;
                            try {
                                setDeleting(true);
                                await deleteWorkoutPlan(plan.id, supabase);
                                window.location.href = '/fitness/plans';
                            } catch (e) {
                                console.error('Delete workout plan error:', e);
                                setError(
                                    e instanceof Error ? e.message : 'Failed to delete plan'
                                );
                            } finally {
                                setDeleting(false);
                            }
                        }}
                        className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-3 py-1 font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900 disabled:opacity-60"
                    >
                        {deleting ? 'Deleting…' : 'Delete plan'}
                    </button>
                </div>
                {saveMessage && (
                    <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        {saveMessage}
                    </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <Link
                        href={generatorHref}
                        className="inline-flex items-center rounded-md bg-amber-500 px-3 py-2 font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
                    >
                        Load into generator
                    </Link>
                    <button
                        type="button"
                        disabled={startingSession}
                        onClick={async () => {
                            setSessionError(null);
                            try {
                                setStartingSession(true);
                                const { data: { user }, error: authError } = await supabase.auth.getUser();
                                if (authError || !user) {
                                    window.location.href = '/login';
                                    return;
                                }
                                const session = await createSessionFromPlan(plan.id, user.id, supabase);
                                window.location.href = `/fitness/sessions/${session.id}`;
                            } catch (e) {
                                console.error('Start session error:', e);
                                setSessionError(
                                    e instanceof Error ? e.message : 'Failed to start session from this plan'
                                );
                            } finally {
                                setStartingSession(false);
                            }
                        }}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-60"
                    >
                        {startingSession ? 'Starting…' : 'Start session'}
                    </button>
                </div>
                {sessionError && (
                    <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
                        {sessionError}
                    </p>
                )}
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Load into generator: loads this plan&apos;s muscles, difficulty, and item count into the workout generator.
                </p>
            </header>

            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Workout items
                </h2>
                {itemCount === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        This plan has no items yet.
                    </p>
                ) : (
                    <ol className="list-decimal list-inside space-y-2 text-sm text-slate-800 dark:text-slate-100">
                        {plan.items.map((item) => (
                            <li key={item.id}>
                                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <Link
                                            href={`/fitness/exercises/${encodeURIComponent(item.exercise_slug)}`}
                                            className="font-semibold text-slate-900 hover:text-amber-600 dark:text-white dark:hover:text-amber-300"
                                        >
                                            {item.exercise_slug}
                                        </Link>
                                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                            <span>
                                                <span className="font-semibold">Sets:</span> {item.sets}
                                            </span>
                                            <span>
                                                <span className="font-semibold">Reps:</span> {item.rep_range}
                                            </span>
                                            <span>
                                                <span className="font-semibold">Rest:</span> {item.rest_seconds} sec
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                        {item.movement_pattern && (
                                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                Pattern: {item.movement_pattern}
                                            </span>
                                        )}
                                        {item.mechanic && (
                                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                Mechanic: {item.mechanic}
                                            </span>
                                        )}
                                    </div>
                                    {item.note && (
                                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            {item.note}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </div>
    );
}

