'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type { WorkoutPlan } from '@/lib/fitness/workoutPlans';
import { listWorkoutPlansForUser } from '@/lib/fitness/workoutPlans';

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
    const [plans, setPlans] = useState<WorkoutPlan[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

                const data = await listWorkoutPlansForUser(user.id, supabase);
                if (!cancelled) {
                    setPlans(data);
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
                        href="/fitness/exercises"
                        className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                        ← Back to Exercises
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
                    href="/fitness/exercises"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Exercises
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Saved Workout Plans
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    These are workout plans you&apos;ve saved from the generator.
                </p>
            </header>

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            )}

            {!error && plans && plans.length === 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    You don&apos;t have any saved workout plans yet. Generate a workout and save it as a plan from the workout generator.
                </div>
            )}

            {plans && plans.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                    {plans.map(plan => (
                        <li key={plan.id}>
                            <Link
                                href={`/fitness/plans/${plan.id}`}
                                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-amber-500/60 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-400/60 dark:hover:bg-slate-800"
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
                                            Muscles: {plan.muscle_slugs.join(', ')}
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
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

