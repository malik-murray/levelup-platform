'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type { WorkoutPlanWithItemCount } from '@/lib/fitness/workoutPlans';
import { listWorkoutPlansForUserWithItemCounts } from '@/lib/fitness/workoutPlans';
import { createSessionFromPlan, getInProgressSessionsByPlanForUser } from '@/lib/fitness/workoutSessions';

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

export default function PlansListClient() {
    const [plans, setPlans] = useState<WorkoutPlanWithItemCount[] | null>(null);
    const [inProgressByPlan, setInProgressByPlan] = useState<Record<string, { id: string }>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startingPlanId, setStartingPlanId] = useState<string | null>(null);
    const [startError, setStartError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    window.location.href = '/login';
                    return;
                }

                const [plansData, sessionsByPlan] = await Promise.all([
                    listWorkoutPlansForUserWithItemCounts(user.id, supabase),
                    getInProgressSessionsByPlanForUser(user.id, supabase),
                ]);
                if (!cancelled) {
                    setPlans(plansData);
                    setInProgressByPlan(
                        Object.fromEntries(
                            Object.entries(sessionsByPlan).map(([planId, s]) => [planId, { id: s.id }])
                        )
                    );
                }
            } catch (e) {
                console.error('Error loading workout plans list:', e);
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load workout plans');
                    setPlans([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <div className="space-y-4 pb-8">
                <header className="space-y-2">
                    <Link
                        href="/fitness"
                        className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Saved Workout Plans
                    </h1>
                </header>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading plans…</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <Link
                    href="/fitness"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Dashboard
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Saved Workout Plans
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            These are workout plans you&apos;ve saved from the generator.
                        </p>
                    </div>
                    <Link
                        href="/fitness/workout-generator"
                        className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
                    >
                        + Create workout
                    </Link>
                </div>
            </header>

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            )}

            {!error && plans && plans.length === 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <p>You don&apos;t have any saved workout plans yet.</p>
                    <p className="mt-2">
                        <Link
                            href="/fitness/workout-generator"
                            className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                            Generate a workout
                        </Link>
                        {' '}and save it as a plan to get started.
                    </p>
                </div>
            )}

            {startError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {startError}
                </div>
            )}

            {plans && plans.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                    {plans.map(plan => (
                        <li key={plan.id}>
                            <div className="flex flex-col rounded-lg border border-slate-200 bg-white hover:border-amber-500/60 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-400/60 dark:hover:bg-slate-800">
                                <Link
                                    href={`/fitness/plans/${plan.id}`}
                                    className="block p-4 flex-1"
                                >
                                    <h2 className="font-semibold text-slate-900 dark:text-white">
                                        {plan.name}
                                    </h2>
                                    {plan.description && (
                                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                            {plan.description}
                                        </p>
                                    )}
                                    <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                                        {plan.muscle_slugs.length > 0 && (
                                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                {plan.muscle_slugs
                                                    .map((s) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
                                                    .join(', ')}
                                            </span>
                                        )}
                                        {plan.difficulty && (
                                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                Difficulty: {plan.difficulty}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                        Updated: {formatDate(plan.updated_at || plan.created_at)}
                                    </p>
                                </Link>
                                <div className="px-4 pb-4 pt-0">
                                    {inProgressByPlan[plan.id] ? (
                                        <Link
                                            href={`/fitness/sessions/${inProgressByPlan[plan.id].id}`}
                                            title="Continue your in-progress workout"
                                            className="block w-full rounded-md border border-amber-500/80 bg-amber-500/90 px-3 py-1.5 text-center text-xs font-medium text-black hover:bg-amber-400/90 dark:bg-amber-400/90 dark:text-black dark:hover:bg-amber-300/90"
                                        >
                                            Continue session
                                        </Link>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={plan.item_count === 0 || startingPlanId !== null}
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                setStartError(null);
                                                setStartingPlanId(plan.id);
                                                try {
                                                    const { data: { user }, error: authError } = await supabase.auth.getUser();
                                                    if (authError || !user) {
                                                        window.location.href = '/login';
                                                        return;
                                                    }
                                                    const session = await createSessionFromPlan(plan.id, user.id, supabase);
                                                    window.location.href = `/fitness/sessions/${session.id}`;
                                                } catch (err) {
                                                    console.error('Start session error:', err);
                                                    setStartError(
                                                        err instanceof Error ? err.message : 'Failed to start session'
                                                    );
                                                } finally {
                                                    setStartingPlanId(null);
                                                }
                                            }}
                                            title={plan.item_count === 0 ? 'Add exercises to this plan first' : 'Start a workout from this plan'}
                                            className="w-full rounded-md border border-amber-500/80 bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400/90 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-amber-400/90 dark:text-black dark:hover:bg-amber-300/90"
                                        >
                                            {startingPlanId === plan.id ? 'Starting…' : 'Start session'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

