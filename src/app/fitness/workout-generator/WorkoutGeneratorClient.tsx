'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { getMuscleGroups, getEquipment } from '@/lib/fitness/exercises';
import type { MuscleGroup, Equipment, ExerciseDifficulty } from '@/lib/fitness/types';
import { generateWorkoutPlanFromCatalog, type GeneratedWorkoutItem } from '@/lib/fitness/workoutGenerator';
import { createWorkoutPlanFromGeneratedPlan } from '@/lib/fitness/workoutPlans';

type DifficultyOption = '' | ExerciseDifficulty;

const DIFFICULTY_OPTIONS: { value: DifficultyOption; label: string }[] = [
    { value: '', label: 'Any' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'all_levels', label: 'All levels' },
];

export default function WorkoutGeneratorClient() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
    const [equipmentSlug, setEquipmentSlug] = useState('');
    const [difficulty, setDifficulty] = useState<DifficultyOption>('');
    const [count, setCount] = useState('5');

    const [workout, setWorkout] = useState<GeneratedWorkoutItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [planName, setPlanName] = useState('');
    const [planDescription, setPlanDescription] = useState('');

    const [hydratedFromUrl, setHydratedFromUrl] = useState(false);

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
        } catch (e) {
            console.error('Load generator reference data:', e);
            setError(e instanceof Error ? e.message : 'Failed to load generator reference data');
        }
    }, []);

    useEffect(() => {
        loadReferenceData();
    }, [loadReferenceData]);

    // Initial URL -> state hydration
    useEffect(() => {
        if (!searchParams) return;
        if (hydratedFromUrl) return;

        const musclesParam = searchParams.get('muscles');
        const equipmentParam = searchParams.get('equipment') || '';
        const difficultyParam = (searchParams.get('difficulty') || '') as DifficultyOption;
        const countParam = searchParams.get('count') || '';

        if (musclesParam) {
            const slugs = musclesParam
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            if (slugs.length > 0) setSelectedMuscles(slugs);
        }
        if (equipmentParam) setEquipmentSlug(equipmentParam);
        if (difficultyParam) setDifficulty(difficultyParam);
        if (countParam && !Number.isNaN(Number(countParam))) setCount(countParam);

        setHydratedFromUrl(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, hydratedFromUrl]);

    const toggleMuscle = (slug: string) => {
        setSelectedMuscles((prev) =>
            prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
        );
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setSaveError(null);
        setSaveSuccess(null);
        setWorkout(null);
        try {
            const numericCount = Math.max(1, Math.min(12, Number.isNaN(Number(count)) ? 5 : Number(count)));
            const result = await generateWorkoutPlanFromCatalog(
                {
                    muscleSlugs: selectedMuscles,
                    equipmentSlug: equipmentSlug || undefined,
                    difficulty: difficulty || undefined,
                    count: numericCount,
                    publishedOnly: true,
                },
                supabase
            );
            setWorkout(result);
        } catch (e) {
            console.error('Generate workout error:', e);
            setError(e instanceof Error ? e.message : 'Failed to generate workout');
        } finally {
            setLoading(false);
        }
    };

    // State -> URL sync
    useEffect(() => {
        if (!hydratedFromUrl) return;
        if (!pathname) return;

        const params = new URLSearchParams();

        if (selectedMuscles.length > 0) {
            params.set('muscles', selectedMuscles.join(','));
        }
        if (equipmentSlug) {
            params.set('equipment', equipmentSlug);
        }
        if (difficulty) {
            params.set('difficulty', difficulty);
        }
        const numericCount = Number(count);
        const defaultCount = 5;
        if (!Number.isNaN(numericCount) && numericCount !== defaultCount) {
            params.set('count', String(numericCount));
        }

        const query = params.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        router.replace(url, { scroll: false });
    }, [selectedMuscles, equipmentSlug, difficulty, count, hydratedFromUrl, pathname, router]);

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
                    Workout Generator (v1)
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Generate a simple, rule-based workout from the exercise catalog. Pick target muscles and optional constraints, then review the suggested exercises.
                </p>
            </header>

            <section className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Inputs
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                        <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            Target muscles
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {muscles.map((m) => (
                                <button
                                    key={m.slug}
                                    type="button"
                                    onClick={() => toggleMuscle(m.slug)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                        selectedMuscles.includes(m.slug)
                                            ? 'border-amber-500 bg-amber-500 text-black dark:border-amber-400 dark:bg-amber-400'
                                            : 'border-slate-300 bg-white text-slate-700 hover:border-amber-500 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-400 dark:hover:text-amber-300'
                                    }`}
                                >
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
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
                        <label className="flex flex-col gap-1 text-xs">
                            <span className="font-medium text-slate-500 dark:text-slate-400">
                                Difficulty (optional)
                            </span>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value as DifficultyOption)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                                {DIFFICULTY_OPTIONS.map((opt) => (
                                    <option key={opt.value || 'any'} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs">
                            <span className="font-medium text-slate-500 dark:text-slate-400">
                                Exercise count
                            </span>
                            <input
                                type="number"
                                min={1}
                                max={12}
                                value={count}
                                onChange={(e) => setCount(e.target.value)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                        </label>
                    </div>
                </div>
                <div>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="inline-flex items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
                        disabled={loading}
                    >
                        {loading ? 'Generating…' : 'Generate workout'}
                    </button>
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
                                            <div className="flex flex-wrap gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                {ex.primary_muscle_group && (
                                                    <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                        {ex.primary_muscle_group.name}
                                                    </span>
                                                )}
                                                {ex.equipment && (
                                                    <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                        {ex.equipment.name}
                                                    </span>
                                                )}
                                                <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                    {ex.difficulty}
                                                </span>
                                                {ex.movement_pattern && (
                                                    <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                        {ex.movement_pattern}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {ex.short_description && (
                                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                                {ex.short_description}
                                            </p>
                                        )}
                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                                            <span>
                                                <span className="font-semibold">Sets:</span> {item.sets}
                                            </span>
                                            <span>
                                                <span className="font-semibold">Reps:</span> {item.repRange}
                                            </span>
                                            <span>
                                                <span className="font-semibold">Rest:</span> {item.restSeconds} sec
                                            </span>
                                        </div>
                                        {item.note && (
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                {item.note}
                                            </p>
                                        )}
                                    </Link>
                                </li>
                            )})}
                        </ol>
                    )}
                </section>
            )}

            {workout && workout.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Save as plan
                    </h2>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="flex flex-col gap-1">
                                <span className="font-medium text-slate-500 dark:text-slate-400">
                                    Plan name
                                </span>
                                <input
                                    type="text"
                                    value={planName}
                                    onChange={(e) => setPlanName(e.target.value)}
                                    placeholder={selectedMuscles.length === 1 ? `${muscles.find(m => m.slug === selectedMuscles[0])?.name ?? 'Workout'} Plan` : 'Generated Workout Plan'}
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="font-medium text-slate-500 dark:text-slate-400">
                                    Description (optional)
                                </span>
                                <textarea
                                    value={planDescription}
                                    onChange={(e) => setPlanDescription(e.target.value)}
                                    rows={2}
                                    placeholder="Short note about when or how to use this plan."
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                />
                            </label>
                        </div>
                        {saveError && (
                            <p className="mt-2 text-[11px] text-red-500 dark:text-red-400">
                                {saveError}
                            </p>
                        )}
                        {saveSuccess && (
                            <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                                {saveSuccess}{' '}
                                <Link
                                    href="/fitness/plans"
                                    className="underline underline-offset-2 hover:text-emerald-500 dark:hover:text-emerald-300"
                                >
                                    View all plans
                                </Link>
                            </p>
                        )}
                        <div className="mt-3">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={async () => {
                                    setSaveError(null);
                                    setSaveSuccess(null);

                                    if (!workout || workout.length === 0) {
                                        setSaveError('Generate a workout before saving as a plan.');
                                        return;
                                    }

                                    const trimmedName = planName.trim();
                                    if (!trimmedName) {
                                        setSaveError('Plan name is required.');
                                        return;
                                    }

                                    try {
                                        setSaving(true);
                                        const {
                                            data: { user },
                                            error: authError,
                                        } = await supabase.auth.getUser();

                                        if (authError || !user) {
                                            window.location.href = '/login';
                                            return;
                                        }

                                        const plan = await createWorkoutPlanFromGeneratedPlan(
                                            {
                                                name: trimmedName,
                                                description: planDescription.trim() || undefined,
                                                muscleSlugs: selectedMuscles,
                                                difficulty: difficulty || undefined,
                                                isTemplate: false,
                                                items: workout,
                                                userId: user.id,
                                            },
                                            supabase
                                        );

                                        setSaveSuccess(
                                            `Plan "${plan.name}" saved with ${plan.items.length} exercise${plan.items.length === 1 ? '' : 's'}.`
                                        );
                                    } catch (e) {
                                        console.error('Save workout plan error:', e);
                                        setSaveError(
                                            e instanceof Error ? e.message : 'Failed to save workout plan'
                                        );
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                            >
                                {saving ? 'Saving…' : 'Save as plan'}
                            </button>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

