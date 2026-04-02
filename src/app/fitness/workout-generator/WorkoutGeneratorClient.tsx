'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { getMuscleGroups, getEquipment } from '@/lib/fitness/exercises';
import type { MuscleGroup, Equipment, ExerciseDifficulty } from '@/lib/fitness/types';
import {
    generateWorkout,
    type GeneratedWorkoutItem,
    type WorkoutDifficulty,
} from '@/lib/fitness/workoutGenerator';
import { createWorkoutPlanFromGeneratedPlan } from '@/lib/fitness/workoutPlans';

const DIFFICULTY_OPTIONS: { value: WorkoutDifficulty; label: string }[] = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
];

export default function WorkoutGeneratorClient() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [muscleSlug, setMuscleSlug] = useState('');
    const [difficulty, setDifficulty] = useState<WorkoutDifficulty>('intermediate');
    const [equipmentSlug, setEquipmentSlug] = useState('');

    const [workout, setWorkout] = useState<GeneratedWorkoutItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [planName, setPlanName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hydratedFromUrl, setHydratedFromUrl] = useState(false);

    const defaultPlanName = useMemo(() => {
        const muscleLabel = muscles.find((m) => m.slug === muscleSlug)?.name ?? 'Workout';
        const diffLabel = DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.label ?? '';
        return diffLabel ? `${diffLabel} ${muscleLabel} Workout` : `${muscleLabel} Workout`;
    }, [muscles, muscleSlug, difficulty]);

    const hasManuallyEditedPlanName = useRef(false);

    useEffect(() => {
        if (workout && workout.length > 0 && !hasManuallyEditedPlanName.current) {
            setPlanName(defaultPlanName);
        }
    }, [workout, defaultPlanName]);

    const loadReferenceData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            const [muscleData, equipData] = await Promise.all([
                getMuscleGroups(supabase),
                getEquipment(supabase),
            ]);
            setMuscles(muscleData);
            setEquipment(equipData);
            if (!muscleSlug && muscleData.length > 0) {
                setMuscleSlug(muscleData[0].slug);
            }
        } catch (e) {
            console.error('Load generator reference data:', e);
            setError(e instanceof Error ? e.message : 'Failed to load generator reference data');
        }
    }, []);

    useEffect(() => {
        loadReferenceData();
    }, [loadReferenceData]);

    useEffect(() => {
        if (muscles.length > 0 && !muscleSlug) {
            setMuscleSlug(muscles[0].slug);
        }
    }, [muscles, muscleSlug]);

    // Initial URL -> state hydration
    useEffect(() => {
        if (!searchParams) return;
        if (hydratedFromUrl) return;

        const muscleParam = searchParams.get('muscle') || '';
        const equipParam = searchParams.get('equipment') || '';
        const diffParam = searchParams.get('difficulty') || '';

        if (muscleParam) setMuscleSlug(muscleParam);
        if (equipParam) setEquipmentSlug(equipParam);
        if (diffParam && DIFFICULTY_OPTIONS.some((o) => o.value === diffParam)) {
            setDifficulty(diffParam as WorkoutDifficulty);
        }

        setHydratedFromUrl(true);
    }, [searchParams, hydratedFromUrl, muscles]);

    const handleGenerate = useCallback(async () => {
        if (!muscleSlug) {
            setError('Select a muscle group.');
            return;
        }
        setLoading(true);
        setError(null);
        setSaveError(null);
        setWorkout(null);
        hasManuallyEditedPlanName.current = false;
        try {
            const result = await generateWorkout({
                muscleSlug,
                difficulty,
                equipmentSlug: equipmentSlug || undefined,
                supabase,
            });
            setWorkout(result.exercises);
        } catch (e) {
            console.error('Generate workout error:', e);
            setError(e instanceof Error ? e.message : 'Failed to generate workout');
        } finally {
            setLoading(false);
        }
    }, [muscleSlug, difficulty, equipmentSlug]);

    const handleSave = useCallback(async () => {
        if (!workout || workout.length === 0) return;
        const trimmedName = planName.trim();
        if (!trimmedName) {
            setSaveError('Plan name is required.');
            return;
        }

        setSaving(true);
        setSaveError(null);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                window.location.href = '/login';
                return;
            }

            const plan = await createWorkoutPlanFromGeneratedPlan(
                {
                    name: trimmedName,
                    muscleSlugs: [muscleSlug],
                    difficulty: difficulty as ExerciseDifficulty,
                    isTemplate: false,
                    items: workout,
                    userId: user.id,
                },
                supabase
            );

            router.push(`/fitness/plans/${plan.id}`);
        } catch (e) {
            console.error('Save workout plan error:', e);
            setSaveError(e instanceof Error ? e.message : 'Failed to save plan');
        } finally {
            setSaving(false);
        }
    }, [workout, planName, muscleSlug, difficulty, router]);

    // State -> URL sync
    useEffect(() => {
        if (!hydratedFromUrl || !pathname) return;

        const params = new URLSearchParams();
        if (muscleSlug) params.set('muscle', muscleSlug);
        if (equipmentSlug) params.set('equipment', equipmentSlug);
        if (difficulty) params.set('difficulty', difficulty);

        const query = params.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        router.replace(url, { scroll: false });
    }, [muscleSlug, equipmentSlug, difficulty, hydratedFromUrl, pathname, router]);

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                        href="/fitness"
                        className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                        ← Dashboard
                    </Link>
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    <Link
                        href="/fitness/exercises"
                        className="text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-300"
                    >
                        Exercises
                    </Link>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Workout Generator
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Generate a simple workout (4–6 exercises) from the catalog. Pick muscle group,
                    experience level, and optional equipment.
                </p>
            </header>

            <section className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Inputs
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                            Muscle group
                        </span>
                        <select
                            value={muscleSlug}
                            onChange={(e) => setMuscleSlug(e.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                            <option value="">Select muscle…</option>
                            {muscles.map((m) => (
                                <option key={m.slug} value={m.slug}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                            Experience level
                        </span>
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as WorkoutDifficulty)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                            {DIFFICULTY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                            Equipment (optional)
                        </span>
                        <select
                            value={equipmentSlug}
                            onChange={(e) => setEquipmentSlug(e.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                            <option value="">Any</option>
                            {equipment.map((eq) => (
                                <option key={eq.slug} value={eq.slug}>
                                    {eq.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300 disabled:opacity-60"
                        disabled={loading || !muscleSlug}
                    >
                        {loading ? 'Generating…' : 'Generate Workout'}
                    </button>
                    {workout && workout.length > 0 && (
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={loading}
                            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-60"
                        >
                            Regenerate
                        </button>
                    )}
                </div>
            </section>

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            )}

            {workout && (
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Generated workout
                    </h2>
                    {workout.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            No exercises matched the chosen criteria. Try broadening your filters.
                        </p>
                    ) : (
                        <ol className="list-decimal list-inside space-y-2">
                            {workout.map((item) => {
                                const ex = item.exercise;
                                return (
                                    <li key={ex.id}>
                                        <Link
                                            href={`/fitness/exercises/${ex.slug}`}
                                            className="block rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-amber-500/60 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-amber-400/60 dark:hover:bg-slate-800"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    {ex.name}
                                                </span>
                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                    {item.sets} × {item.repRange}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                {ex.primary_muscle_group && (
                                                    <span className="rounded bg-slate-200 px-2 py-0.5 dark:bg-slate-700">
                                                        {ex.primary_muscle_group.name}
                                                    </span>
                                                )}
                                                {ex.equipment && (
                                                    <span className="rounded bg-slate-200 px-2 py-0.5 dark:bg-slate-700">
                                                        {ex.equipment.name}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </section>
            )}

            {workout && workout.length > 0 && (
                <section className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Save as plan
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                        <label className="flex flex-col gap-1 text-xs min-w-0 sm:max-w-xs">
                            <span className="font-medium text-slate-500 dark:text-slate-400">
                                Plan name
                            </span>
                            <input
                                type="text"
                                value={planName}
                                onChange={(e) => {
                                    hasManuallyEditedPlanName.current = true;
                                    setPlanName(e.target.value);
                                    setSaveError(null);
                                }}
                                placeholder={defaultPlanName}
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !planName.trim()}
                            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white shrink-0"
                        >
                            {saving ? 'Saving…' : 'Save as Plan'}
                        </button>
                    </div>
                    {saveError && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                            {saveError}
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
