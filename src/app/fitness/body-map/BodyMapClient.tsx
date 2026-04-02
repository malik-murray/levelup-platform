'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { BodyMap } from '../exercises/components/BodyMap';
import { getExercisesByFilters } from '@/lib/fitness/exercises';
import type { ExerciseWithRelations } from '@/lib/fitness/types';
import {
    getRegionLabelForMuscleSlug,
    loadRecentMuscles,
    addRecentMuscle,
    clearRecentMuscles,
} from '@/lib/fitness/bodyMap';

function formatLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BodyMapClient() {
    const [selectedMuscleSlug, setSelectedMuscleSlug] = useState('');
    const [exercises, setExercises] = useState<ExerciseWithRelations[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentMuscles, setRecentMuscles] = useState<string[]>([]);

    useEffect(() => {
        setRecentMuscles(loadRecentMuscles());
    }, []);

    const loadExercises = useCallback(async () => {
        if (!selectedMuscleSlug) {
            setExercises([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();
            if (authError || !user) {
                window.location.href = '/login';
                return;
            }
            const list = await getExercisesByFilters(
                {
                    muscleSlug: selectedMuscleSlug,
                    publishedOnly: true,
                },
                supabase
            );
            setExercises(list);
        } catch (e) {
            console.error('Body map load exercises:', e);
            setError(e instanceof Error ? e.message : 'Failed to load exercises');
            setExercises([]);
        } finally {
            setLoading(false);
        }
    }, [selectedMuscleSlug]);

    useEffect(() => {
        loadExercises();
    }, [loadExercises]);

    const selectedLabel = selectedMuscleSlug
        ? getRegionLabelForMuscleSlug(selectedMuscleSlug) ?? selectedMuscleSlug
        : null;

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href="/fitness/exercises"
                            className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                            ← Back to Exercises
                        </Link>
                        <Link
                            href="/fitness/exercises/saved"
                            className="inline-block text-xs text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-300"
                        >
                            Saved exercises
                        </Link>
                    </div>
                    {selectedLabel && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Selected region:{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {selectedLabel}
                            </span>
                        </p>
                    )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Body Map
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Select a muscle group to explore exercises by body region.
                </p>
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
                                    onClick={() => setSelectedMuscleSlug(slug)}
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

            <BodyMap
                selectedMuscleSlug={selectedMuscleSlug}
                onSelectMuscleSlug={(slug) => {
                    setSelectedMuscleSlug(slug);
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

            <section className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Exercises
                </h2>
                {!selectedMuscleSlug ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Select a muscle region on the body map to see matching exercises.
                    </p>
                ) : loading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Loading exercises for {selectedLabel ?? selectedMuscleSlug}…
                    </p>
                ) : exercises.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        No published exercises found for this muscle group yet.
                    </p>
                ) : (
                    <>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {exercises.length} exercise{exercises.length === 1 ? '' : 's'} found
                            for {selectedLabel ?? selectedMuscleSlug}.
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                            {exercises.map((ex) => (
                                <li key={ex.id}>
                                    <Link
                                        href={`/fitness/exercises/${ex.slug}`}
                                        className="block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 h-full hover:border-amber-500/50 dark:hover:border-amber-400/50 hover:shadow-md transition-colors"
                                    >
                                        <h3 className="font-semibold text-slate-900 dark:text-white">
                                            {ex.name}
                                        </h3>
                                        {ex.short_description && (
                                            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                                                {ex.short_description}
                                            </p>
                                        )}
                                        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
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
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>
        </div>
    );
}

