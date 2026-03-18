'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import {
    getMuscleGroups,
    getEquipment,
    getExercisesByFilters,
    listSavedExercises,
    saveExercise,
    unsaveExercise,
} from '@/lib/fitness/exercises';
import type { ExerciseWithRelations, MuscleGroup, Equipment } from '@/lib/fitness/types';
import type { ExerciseDifficulty } from '@/lib/fitness/types';
import { BodyMap } from './components/BodyMap';
import {
    loadRecentMuscles,
    addRecentMuscle,
    clearRecentMuscles,
    getRegionLabelForMuscleSlug,
} from '@/lib/fitness/bodyMap';

const DIFFICULTY_OPTIONS: { value: '' | ExerciseDifficulty; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'all_levels', label: 'All levels' },
];

function formatLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const hasActiveFilters = (
    muscleSlug: string,
    equipmentSlug: string,
    difficulty: string,
    search: string,
    tag: string
) => Boolean(muscleSlug || equipmentSlug || difficulty || search.trim() || tag);

export default function ExercisesClient() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [exercises, setExercises] = useState<ExerciseWithRelations[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
    const [savedExerciseIds, setSavedExerciseIds] = useState<Set<string>>(new Set());

    const [muscleSlug, setMuscleSlug] = useState('');
    const [equipmentSlug, setEquipmentSlug] = useState('');
    const [difficulty, setDifficulty] = useState<'' | ExerciseDifficulty>('');
    const [search, setSearch] = useState('');
    const [tag, setTag] = useState('');

    const [recentMuscles, setRecentMuscles] = useState<string[]>([]);
    // Prevent URL-sync effect from firing while we are hydrating initial state from URL
    const [hydratedFromUrl, setHydratedFromUrl] = useState(false);

    // Initial hydration from URL (run once on mount)
    useEffect(() => {
        if (!searchParams) return;

        const urlMuscle = searchParams.get('muscle') || '';
        const urlEquipment = searchParams.get('equipment') || '';
        const urlDifficulty = (searchParams.get('difficulty') || '') as '' | ExerciseDifficulty;
        const urlSearch = searchParams.get('search') || '';
        const urlTag = searchParams.get('tag') || '';

        if (urlMuscle) setMuscleSlug(urlMuscle);
        if (urlEquipment) setEquipmentSlug(urlEquipment);
        if (urlDifficulty) setDifficulty(urlDifficulty);
        if (urlSearch) setSearch(urlSearch);
        if (urlTag) setTag(urlTag);

        setHydratedFromUrl(true);
        setRecentMuscles(loadRecentMuscles());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadReferenceData = useCallback(async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            const [groups, equip, saved] = await Promise.all([
                getMuscleGroups(supabase),
                getEquipment(supabase),
                listSavedExercises(supabase),
            ]);
            setMuscleGroups(groups);
            setEquipment(equip);
            setSavedExerciseIds(new Set(saved.map((ex) => ex.id)));
        } catch (e) {
            console.error('Load reference data:', e);
            setError(e instanceof Error ? e.message : 'Failed to load filters');
        }
    }, []);

    const loadExercises = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            const list = await getExercisesByFilters(
                {
                    muscleSlug: muscleSlug || undefined,
                    equipmentSlug: equipmentSlug || undefined,
                    difficulty: difficulty || undefined,
                    tag: tag || undefined,
                    search: search.trim() || undefined,
                    publishedOnly: true,
                },
                supabase
            );
            setExercises(list);
        } catch (e) {
            console.error('Load exercises:', e);
            setError(e instanceof Error ? e.message : 'Failed to load exercises');
            setExercises([]);
        } finally {
            setLoading(false);
        }
    }, [muscleSlug, equipmentSlug, difficulty, search, tag]);

    useEffect(() => {
        loadReferenceData();
    }, [loadReferenceData]);

    useEffect(() => {
        loadExercises();
    }, [loadExercises]);

    // Sync state -> URL (after initial hydration)
    useEffect(() => {
        if (!hydratedFromUrl) return;
        if (!pathname) return;

        const params = new URLSearchParams();
        if (muscleSlug) params.set('muscle', muscleSlug);
        if (equipmentSlug) params.set('equipment', equipmentSlug);
        if (difficulty) params.set('difficulty', difficulty);
        if (search.trim()) params.set('search', search.trim());
        if (tag) params.set('tag', tag);

        const query = params.toString();
        const url = query ? `${pathname}?${query}` : pathname;

        router.replace(url, { scroll: false });
    }, [muscleSlug, equipmentSlug, difficulty, search, hydratedFromUrl, pathname, router]);

    const clearFilters = useCallback(() => {
        setMuscleSlug('');
        setEquipmentSlug('');
        setDifficulty('');
        setSearch('');
        setTag('');
    }, []);

    const activeFilters = hasActiveFilters(muscleSlug, equipmentSlug, difficulty, search, tag);

    return (
        <div className="space-y-6 pb-8">
            {/* Title & intro */}
            <header className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Exercise Catalog
                        </h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Browse exercises by muscle group, equipment, and difficulty. Use the body
                            map or filters, then click an exercise for details.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href="/fitness/body-map"
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Open Body Map
                        </Link>
                        <Link
                            href="/fitness/exercises/saved"
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            Saved Exercises
                        </Link>
                    </div>
                </div>
                {recentMuscles.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Recent muscles:
                        </span>
                        {recentMuscles.map((slug) => {
                            const label = getRegionLabelForMuscleSlug(slug) ?? slug;
                            return (
                                <button
                                    key={slug}
                                    type="button"
                                    onClick={() => setMuscleSlug(slug)}
                                    className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => {
                                clearRecentMuscles();
                                setRecentMuscles([]);
                            }}
                            className="text-[11px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        >
                            Clear
                        </button>
                    </div>
                )}
            </header>

            {/* Sticky filter bar */}
            <section className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/95 dark:bg-black/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 sm:-mx-6 sm:px-6">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Muscle group
                            </span>
                            <select
                                value={muscleSlug}
                                onChange={(e) => setMuscleSlug(e.target.value)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white min-w-[140px]"
                            >
                                <option value="">All</option>
                                {muscleGroups.map((mg) => (
                                    <option key={mg.id} value={mg.slug}>
                                        {mg.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Equipment
                            </span>
                            <select
                                value={equipmentSlug}
                                onChange={(e) => setEquipmentSlug(e.target.value)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white min-w-[140px]"
                            >
                                <option value="">All</option>
                                {equipment.map((eq) => (
                                    <option key={eq.id} value={eq.slug}>
                                        {eq.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Difficulty
                            </span>
                            <select
                                value={difficulty}
                                onChange={(e) =>
                                    setDifficulty(e.target.value as '' | ExerciseDifficulty)
                                }
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white min-w-[120px]"
                            >
                                {DIFFICULTY_OPTIONS.map((opt) => (
                                    <option key={opt.value || 'all'} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Search
                            </span>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Name or description..."
                                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-400 w-full"
                            />
                        </label>
                        {activeFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                    {/* Tag filter row */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Tags:
                        </span>
                        {['strength', 'hypertrophy', 'endurance', 'mobility', 'stretching', 'compound', 'isolation'].map(
                            (t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTag((prev) => (prev === t ? '' : t))}
                                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                        tag === t
                                            ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/40 dark:text-amber-200'
                                            : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    #{t}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </section>

            {/* Body map selector */}
            <BodyMap
                selectedMuscleSlug={muscleSlug}
                onSelectMuscleSlug={(slug) => {
                    setMuscleSlug(slug);
                    if (slug) {
                        addRecentMuscle(slug);
                        setRecentMuscles(loadRecentMuscles());
                    }
                }}
            />

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Results count */}
            <p className="text-sm text-slate-600 dark:text-slate-300">
                {loading
                    ? 'Loading…'
                    : `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`}
            </p>

            {/* Results: cards or empty state */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                            key={i}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 h-40 animate-pulse"
                        />
                    ))}
                </div>
            ) : exercises.length === 0 ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-6 py-12 text-center">
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                        No exercises match your filters
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Try changing muscle group, equipment, difficulty, or search.
                    </p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                    {exercises.map((ex) => (
                        <li key={ex.id}>
                            <Link
                                href={`/fitness/exercises/${ex.slug}`}
                                className="block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 h-full hover:border-amber-500/50 dark:hover-border-amber-400/50 hover:shadow-md transition-colors"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="font-semibold text-slate-900 dark:text-white">
                                        {ex.name}
                                    </h2>
                                    <button
                                        type="button"
                                        aria-label={
                                            savedExerciseIds.has(ex.id)
                                                ? 'Remove from saved exercises'
                                                : 'Save exercise'
                                        }
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSavingIds((prev) => ({ ...prev, [ex.id]: true }));
                                            try {
                                                if (savedExerciseIds.has(ex.id)) {
                                                    await unsaveExercise(ex.id, supabase);
                                                    setSavedExerciseIds((prev) => {
                                                        const next = new Set(prev);
                                                        next.delete(ex.id);
                                                        return next;
                                                    });
                                                } else {
                                                    await saveExercise(ex.id, supabase);
                                                    setSavedExerciseIds((prev) => {
                                                        const next = new Set(prev);
                                                        next.add(ex.id);
                                                        return next;
                                                    });
                                                }
                                            } catch (err) {
                                                console.error('Toggle save exercise error:', err);
                                            } finally {
                                                setSavingIds((prev) => ({
                                                    ...prev,
                                                    [ex.id]: false,
                                                }));
                                            }
                                        }}
                                        className={`ml-2 rounded-full border px-2 py-1 text-xs font-medium ${
                                            savedExerciseIds.has(ex.id)
                                                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/40 dark:text-amber-200'
                                                : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                                        }`}
                                        disabled={!!savingIds[ex.id]}
                                    >
                                        {savingIds[ex.id]
                                            ? 'Saving…'
                                            : savedExerciseIds.has(ex.id)
                                            ? 'Saved'
                                            : 'Save'}
                                    </button>
                                </div>
                                {ex.short_description && (
                                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                                        {ex.short_description}
                                    </p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                                    {ex.primary_muscle_group && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                window.location.href = `/fitness/muscles/${encodeURIComponent(
                                                    ex.primary_muscle_group!.slug
                                                )}`;
                                            }}
                                            className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                                        >
                                            {ex.primary_muscle_group.name}
                                        </button>
                                    )}
                                    {ex.equipment && (
                                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                            {ex.equipment.name}
                                        </span>
                                    )}
                                    <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                        {formatLabel(ex.difficulty)}
                                    </span>
                                    {ex.movement_pattern && (
                                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                            {formatLabel(ex.movement_pattern)}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

