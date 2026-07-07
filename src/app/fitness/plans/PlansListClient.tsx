'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type { WorkoutPlanWithItemCount } from '@/lib/fitness/workoutPlans';
import { listWorkoutPlansForUserWithItemCounts } from '@/lib/fitness/workoutPlans';
import { createSessionFromPlan, getInProgressSessionsByPlanForUser } from '@/lib/fitness/workoutSessions';
import { getFitnessUserProfileForUser, type FitnessEquipmentAccess, type FitnessUserProfile } from '@/lib/fitness/profile';
import { generatePersonalizedStarterPlanForUser } from '@/lib/fitness/personalizedPlans';
import { EQUIPMENT_OPTIONS, toggleValue } from '@/lib/fitness/profileFormOptions';

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
    const [profile, setProfile] = useState<FitnessUserProfile | null>(null);
    const [showEquipmentPanel, setShowEquipmentPanel] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState<FitnessEquipmentAccess[]>([]);
    const [regenerating, setRegenerating] = useState(false);
    const [regenerateError, setRegenerateError] = useState<string | null>(null);
    const [regenerateSuccess, setRegenerateSuccess] = useState<string | null>(null);

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

                const [plansData, sessionsByPlan, profileData] = await Promise.all([
                    listWorkoutPlansForUserWithItemCounts(user.id, supabase),
                    getInProgressSessionsByPlanForUser(user.id, supabase),
                    getFitnessUserProfileForUser(user.id, supabase),
                ]);
                if (!cancelled) {
                    setPlans(plansData);
                    setInProgressByPlan(
                        Object.fromEntries(
                            Object.entries(sessionsByPlan).map(([planId, s]) => [planId, { id: s.id }])
                        )
                    );
                    setProfile(profileData);
                    setSelectedEquipment(profileData?.equipment_access ?? []);
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

    const handleRegenerateForEquipment = async () => {
        if (!profile || selectedEquipment.length === 0) return;
        setRegenerating(true);
        setRegenerateError(null);
        setRegenerateSuccess(null);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                window.location.href = '/login';
                return;
            }
            const created = await generatePersonalizedStarterPlanForUser(
                user.id,
                profile,
                { equipmentOverride: selectedEquipment },
                supabase
            );
            setRegenerateSuccess(`Created "${created.name}".`);
            setShowEquipmentPanel(false);
            const [plansData, sessionsByPlan] = await Promise.all([
                listWorkoutPlansForUserWithItemCounts(user.id, supabase),
                getInProgressSessionsByPlanForUser(user.id, supabase),
            ]);
            setPlans(plansData);
            setInProgressByPlan(
                Object.fromEntries(Object.entries(sessionsByPlan).map(([planId, s]) => [planId, { id: s.id }]))
            );
        } catch (err) {
            setRegenerateError(err instanceof Error ? err.message : 'Failed to regenerate plan');
        } finally {
            setRegenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4 pb-8">
                <header className="space-y-2">
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Saved Workout Plans
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            These are workout plans you&apos;ve saved from the generator.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {profile && (
                            <button
                                type="button"
                                onClick={() => setShowEquipmentPanel((o) => !o)}
                                className="rounded-md border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-400/50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                            >
                                Regenerate for different equipment
                            </button>
                        )}
                        <Link
                            href="/fitness/workout-generator"
                            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
                        >
                            + Create workout
                        </Link>
                    </div>
                </div>

                {showEquipmentPanel && profile && (
                    <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Adjust for home, gym, or whatever you have access to
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                            This creates a new starter plan filtered to the equipment you pick below — your saved
                            training profile is not changed.
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {EQUIPMENT_OPTIONS.map((opt) => (
                                <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={selectedEquipment.includes(opt.value)}
                                        onChange={() => setSelectedEquipment((prev) => toggleValue(prev, opt.value))}
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                        {regenerateError && (
                            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{regenerateError}</p>
                        )}
                        <button
                            type="button"
                            disabled={regenerating || selectedEquipment.length === 0}
                            onClick={handleRegenerateForEquipment}
                            className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-400 dark:hover:bg-amber-300"
                        >
                            {regenerating ? 'Generating…' : 'Regenerate plan'}
                        </button>
                    </div>
                )}
            </header>

            {regenerateSuccess && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    {regenerateSuccess}
                </div>
            )}

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

