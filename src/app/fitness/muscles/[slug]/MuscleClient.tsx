'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import {
    getExercisesByPrimaryMuscle,
    getMuscleGroupBySlug,
} from '@/lib/fitness/exercises';
import type { ExerciseWithRelations, MuscleGroup } from '@/lib/fitness/types';
import { MUSCLE_CONTENT } from '../muscleContent';

type MuscleClientProps = {
    slug: string;
};

function formatRegion(region: string | null | undefined): string {
    if (!region) return 'Unknown region';
    return region.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MuscleClient({ slug }: MuscleClientProps) {
    const [muscle, setMuscle] = useState<MuscleGroup | null | undefined>(undefined);
    const [exercises, setExercises] = useState<ExerciseWithRelations[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            try {
                const [muscleData, exerciseData] = await Promise.all([
                    getMuscleGroupBySlug(slug, supabase),
                    getExercisesByPrimaryMuscle(slug, supabase),
                ]);
                if (cancelled) return;
                setMuscle(muscleData);
                setExercises(exerciseData);
                setError(null);
            } catch (e) {
                if (cancelled) return;
                console.error('Error loading muscle page:', e);
                setError(e instanceof Error ? e.message : 'Failed to load muscle page');
                setMuscle(null);
                setExercises([]);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [slug]);

    if (error) {
        return (
            <div className="space-y-4">
                <Link
                    href="/fitness/exercises"
                    className="text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Exercises
                </Link>
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            </div>
        );
    }

    if (muscle === undefined || exercises === null) {
        return (
            <div className="space-y-4">
                <Link
                    href="/fitness/exercises"
                    className="text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Exercises
                </Link>
                <p className="text-slate-500 dark:text-slate-400">Loading…</p>
            </div>
        );
    }

    if (muscle === null) {
        return (
            <div className="space-y-4">
                <Link
                    href="/fitness/exercises"
                    className="text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Exercises
                </Link>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <p className="font-medium">Muscle not found</p>
                    <p className="mt-1 text-sm">No muscle group with slug &quot;{slug}&quot; exists.</p>
                </div>
            </div>
        );
    }

    const count = exercises?.length ?? 0;
    const regionLabel = formatRegion(muscle.region);
    const content = MUSCLE_CONTENT[muscle.slug];
    const foundationalFromConfig =
        content?.foundationalExerciseSlugs
            .map(slug =>
                (exercises || []).find(ex => ex.slug === slug)
            )
            .filter((ex): ex is ExerciseWithRelations => Boolean(ex)) || [];

    return (
        <div className="space-y-6 pb-8">
            <Link
                href="/fitness/exercises"
                className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
            >
                ← Back to Exercises
            </Link>

            <header className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {muscle.name}
                </h1>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {muscle.slug}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Region: {regionLabel}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {count} exercise{count === 1 ? '' : 's'}
                    </span>
                </div>
                {content && (
                    <>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {content.description}
                        </p>
                        <div className="mt-3 grid gap-3 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Training focus
                                </h2>
                                <p>{content.trainingFocus}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                                <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    Beginner tip
                                </h2>
                                <p>{content.beginnerTip}</p>
                            </div>
                        </div>
                    </>
                )}
                {!content && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Muscle hub for {muscle.name.toLowerCase()}. Browse exercises targeting this muscle, or jump into the full exercise browser.
                    </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                        href={`/fitness/exercises?muscle=${encodeURIComponent(muscle.slug)}`}
                        className="inline-flex items-center rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-black hover:bg-amber-400 dark:bg-amber-400 dark:text-black dark:hover:bg-amber-300"
                    >
                        View in exercise browser
                    </Link>
                    <Link
                        href={`/fitness/workout-generator?muscles=${encodeURIComponent(muscle.slug)}`}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Generate workout for this muscle
                    </Link>
                </div>
            </header>

            <section className="space-y-3">
                {content && content.commonPatterns.length > 0 && (
                    <div className="space-y-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Common patterns
                        </h2>
                        <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1">
                            {content.commonPatterns.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {content && foundationalFromConfig.length > 0 && (
                    <div className="space-y-2">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Foundational exercises
                        </h2>
                        <ul className="list-none p-0 m-0 grid gap-2 text-xs text-slate-600 dark:text-slate-300">
                            {foundationalFromConfig.map((ex) => (
                                <li key={ex.id}>
                                    <Link
                                        href={`/fitness/exercises/${ex.slug}`}
                                        className="inline-flex flex-col rounded-md border border-slate-200 bg-slate-50 px-3 py-2 hover:border-amber-500/60 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-400/60 dark:hover:bg-slate-800"
                                    >
                                        <span className="text-slate-900 dark:text-white font-medium">
                                            {ex.name}
                                        </span>
                                        {ex.short_description && (
                                            <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                                {ex.short_description}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Exercises
                </h2>

                {count === 0 ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        No published exercises for this muscle yet.
                    </div>
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                        {exercises!.map((ex) => (
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
                                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                                        {ex.equipment && (
                                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                                {ex.equipment.name}
                                            </span>
                                        )}
                                        <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                            {ex.difficulty}
                                        </span>
                                        {ex.movement_pattern && (
                                            <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                                {ex.movement_pattern}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

