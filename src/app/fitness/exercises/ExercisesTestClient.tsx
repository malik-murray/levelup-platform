'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import {
    getMuscleGroups,
    getEquipment,
    getExercisesByFilters,
} from '@/lib/fitness/exercises';
import type { ExerciseWithRelations, MuscleGroup, Equipment } from '@/lib/fitness/types';
import type { ExerciseDifficulty } from '@/lib/fitness/types';

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
    search: string
) => Boolean(muscleSlug || equipmentSlug || difficulty || search.trim());

export default function ExercisesTestClient() {
    const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([]);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [exercises, setExercises] = useState<ExerciseWithRelations[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [muscleSlug, setMuscleSlug] = useState('');
    const [equipmentSlug, setEquipmentSlug] = useState('');
    const [difficulty, setDifficulty] = useState<'' | ExerciseDifficulty>('');
    const [search, setSearch] = useState('');

    const loadReferenceData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            const [groups, equip] = await Promise.all([
                getMuscleGroups(supabase),
                getEquipment(supabase),
            ]);
            setMuscleGroups(groups);
            setEquipment(equip);
        } catch (e) {
            console.error('Load reference data:', e);
            setError(e instanceof Error ? e.message : 'Failed to load filters');
        }
    }, []);

    const loadExercises = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            const list = await getExercisesByFilters(
                {
                    muscleSlug: muscleSlug || undefined,
                    equipmentSlug: equipmentSlug || undefined,
                    difficulty: difficulty || undefined,
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
    }, [muscleSlug, equipmentSlug, difficulty, search]);

    useEffect(() => {
        loadReferenceData();
    }, [loadReferenceData]);

    useEffect(() => {
        loadExercises();
    }, [loadExercises]);

    const clearFilters = useCallback(() => {
        setMuscleSlug('');
        setEquipmentSlug('');
        setDifficulty('');
        setSearch('');
    }, []);

    const activeFilters = hasActiveFilters(muscleSlug, equipmentSlug, difficulty, search);

    return (
        <div className="space-y-6 pb-8">
            {/* Title & intro */}
            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Exercise Catalog
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Browse exercises by muscle group, equipment, and difficulty. Click an exercise for details.
                </p>
            </header>

            {/* Sticky filter bar */}
            <section className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/95 dark:bg-black/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 sm:-mx-6 sm:px-6">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Muscle group</span>
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
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Equipment</span>
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
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Difficulty</span>
                            <select
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value as '' | ExerciseDifficulty)}
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
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Search</span>
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
                </div>
            </section>

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Results count */}
            <p className="text-sm text-slate-600 dark:text-slate-300">
                {loading ? 'Loading…' : `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`}
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
                                className="block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 h-full hover:border-amber-500/50 dark:hover:border-amber-400/50 hover:shadow-md transition-colors"
                            >
                                <h2 className="font-semibold text-slate-900 dark:text-white">
                                    {ex.name}
                                </h2>
                                {ex.short_description && (
                                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                                        {ex.short_description}
                                    </p>
                                )}
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {ex.primary_muscle_group && (
                                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                            {ex.primary_muscle_group.name}
                                        </span>
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
                                    {!ex.is_published && (
                                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                            Draft
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
