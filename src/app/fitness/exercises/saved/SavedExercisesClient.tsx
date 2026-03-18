'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { listSavedExercises } from '@/lib/fitness/exercises';
import type { ExerciseWithRelations } from '@/lib/fitness/types';

function formatLabel(value: string | null | undefined): string {
    if (value == null || value === '') return '—';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SavedExercisesClient() {
    const [exercises, setExercises] = useState<ExerciseWithRelations[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const {
                    data: { user },
                    error: authError,
                } = await supabase.auth.getUser();
                if (authError || !user) {
                    window.location.href = '/login';
                    return;
                }
                const saved = await listSavedExercises(supabase);
                if (!cancelled) {
                    setExercises(saved);
                }
            } catch (e) {
                console.error('Load saved exercises:', e);
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load saved exercises');
                    setExercises([]);
                }
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    if (error) {
        return (
            <div className="space-y-4 pb-8">
                <header className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Saved Exercises
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Exercises you&apos;ve bookmarked from the catalog.
                    </p>
                </header>
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            </div>
        );
    }

    if (exercises === null) {
        return (
            <div className="space-y-4 pb-8">
                <header className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Saved Exercises
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Exercises you&apos;ve bookmarked from the catalog.
                    </p>
                </header>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            </div>
        );
    }

    const hasAny = exercises.length > 0;

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Saved Exercises
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Exercises you&apos;ve bookmarked from the catalog.
                        </p>
                    </div>
                    <Link
                        href="/fitness/exercises"
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        ← Browse catalog
                    </Link>
                </div>
            </header>

            {!hasAny ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-6 py-12 text-center">
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                        You haven&apos;t saved any exercises yet.
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Browse the catalog and tap &quot;Save&quot; on any exercise to add it here.
                    </p>
                    <Link
                        href="/fitness/exercises"
                        className="mt-4 inline-flex items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
                    >
                        Go to Exercise Catalog
                    </Link>
                </div>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                    {exercises.map((ex) => (
                        <li key={ex.id}>
                            <Link
                                href={`/fitness/exercises/${ex.slug}`}
                                className="block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 h-full hover:border-amber-500/50 dark:hover-border-amber-400/50 hover:shadow-md transition-colors"
                            >
                                <h2 className="font-semibold text-slate-900 dark:text-white">
                                    {ex.name}
                                </h2>
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
            )}
        </div>
    );
}

