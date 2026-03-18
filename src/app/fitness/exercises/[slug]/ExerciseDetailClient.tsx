'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { getExerciseBySlug } from '@/lib/fitness/exercises';
import type { ExerciseWithRelations } from '@/lib/fitness/types';

type ExerciseDetailClientProps = {
    slug: string;
};

function formatLabel(value: string | null | undefined): string {
    if (value == null || value === '') return 'Not available';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ExerciseDetailClient({ slug }: ExerciseDetailClientProps) {
    const [exercise, setExercise] = useState<ExerciseWithRelations | null | undefined>(undefined);
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
                const data = await getExerciseBySlug(slug, supabase);
                if (!cancelled) {
                    setExercise(data);
                    setError(null);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load exercise');
                    setExercise(null);
                }
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

    if (exercise === undefined) {
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

    if (exercise === null) {
        return (
            <div className="space-y-4">
                <Link
                    href="/fitness/exercises"
                    className="text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Exercises
                </Link>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <p className="font-medium">Exercise not found</p>
                    <p className="mt-1 text-sm">No exercise with slug &quot;{slug}&quot; in the catalog.</p>
                </div>
            </div>
        );
    }

    const hasInstructions = exercise.instructions?.length > 0;
    const hasTips = exercise.tips?.length > 0;
    const hasMistakes = exercise.common_mistakes?.length > 0;
    const hasMedia = Boolean(exercise.media_url ?? exercise.thumbnail_url);

    return (
        <div className="space-y-6">
            <Link
                href="/fitness/exercises"
                className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
            >
                ← Back to Exercises
            </Link>

            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {exercise.name}
                </h1>
                <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">
                    {exercise.slug}
                </p>
            </header>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
                <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {exercise.primary_muscle_group?.name ?? 'Not available'}
                </span>
                <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {exercise.equipment?.name ?? 'Not available'}
                </span>
                <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {formatLabel(exercise.difficulty)}
                </span>
                {exercise.movement_pattern && (
                    <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {formatLabel(exercise.movement_pattern)}
                    </span>
                )}
                {exercise.force_type && (
                    <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {formatLabel(exercise.force_type)}
                    </span>
                )}
                {exercise.mechanic && (
                    <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {formatLabel(exercise.mechanic)}
                    </span>
                )}
                <span className={`rounded px-2 py-1 text-xs font-medium ${exercise.is_published ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {exercise.is_published ? 'Published' : 'Draft'}
                </span>
            </div>

            {exercise.short_description && (
                <section>
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Description
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300">
                        {exercise.short_description}
                    </p>
                </section>
            )}

            {hasMedia && (
                <section>
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        Media
                    </h2>
                    <div className="space-y-2">
                        {exercise.thumbnail_url && (
                            <img
                                src={exercise.thumbnail_url}
                                alt=""
                                className="max-w-xs rounded border border-slate-200 dark:border-slate-700"
                            />
                        )}
                        {exercise.media_url && (
                            <a
                                href={exercise.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-amber-600 hover:underline dark:text-amber-400"
                            >
                                Open video / media
                            </a>
                        )}
                    </div>
                </section>
            )}

            <section>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Metadata
                </h2>
                <dl className="grid gap-1 text-sm">
                    <div className="flex gap-2">
                        <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">Primary muscle</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{exercise.primary_muscle_group?.name ?? 'Not available'}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">Equipment</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{exercise.equipment?.name ?? 'Not available'}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">Difficulty</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{formatLabel(exercise.difficulty)}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">Movement pattern</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{formatLabel(exercise.movement_pattern)}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">Force type</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{formatLabel(exercise.force_type)}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">Mechanic</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{formatLabel(exercise.mechanic)}</dd>
                    </div>
                    <div className="flex gap-2">
                        <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">Published</dt>
                        <dd className="text-slate-700 dark:text-slate-200">{exercise.is_published ? 'Yes' : 'No'}</dd>
                    </div>
                </dl>
            </section>

            {hasInstructions && (
                <section>
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        Instructions
                    </h2>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                        {exercise.instructions.map((step, i) => (
                            <li key={i}>{step}</li>
                        ))}
                    </ol>
                </section>
            )}

            {hasTips && (
                <section>
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        Tips
                    </h2>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                        {exercise.tips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                        ))}
                    </ul>
                </section>
            )}

            {hasMistakes && (
                <section>
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        Common mistakes
                    </h2>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                        {exercise.common_mistakes.map((m, i) => (
                            <li key={i}>{m}</li>
                        ))}
                    </ul>
                </section>
            )}

            {!hasInstructions && !hasTips && !hasMistakes && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    No instructions, tips, or common mistakes recorded for this exercise.
                </p>
            )}
        </div>
    );
}
