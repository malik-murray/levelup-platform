'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { getExerciseBySlug, isExerciseSaved, saveExercise, unsaveExercise } from '@/lib/fitness/exercises';
import { getExerciseHistoryForUser, type ExerciseHistoryEntry } from '@/lib/fitness/workoutSessions';
import type { ExerciseWithRelations, MuscleGroup } from '@/lib/fitness/types';

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
    const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
    const [isSaved, setIsSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState<ExerciseHistoryEntry[] | null>(null);
    const [showAllHistory, setShowAllHistory] = useState(false);

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

                const data = await getExerciseBySlug(slug, supabase);
                if (!cancelled) {
                    setExercise(data);
                    setError(null);
                    setSecondaryMuscles([]);
                    setIsSaved(false);

                    if (data && data.secondary_muscle_group_ids?.length) {
                        try {
                            const { data: secs, error: secError } = await supabase
                                .from('muscle_groups')
                                .select('*')
                                .in('id', data.secondary_muscle_group_ids);
                            if (secError) {
                                console.error('Load secondary muscles error:', secError);
                            } else if (!cancelled && secs) {
                                setSecondaryMuscles(secs as MuscleGroup[]);
                            }
                        } catch (secErr) {
                            console.error('Load secondary muscles exception:', secErr);
                        }
                    }

                    if (data) {
                        try {
                            const [saved, historyData] = await Promise.all([
                                isExerciseSaved(data.id, supabase),
                                getExerciseHistoryForUser(slug, supabase).catch(() => []),
                            ]);
                            if (!cancelled) {
                                setIsSaved(saved);
                                setHistory(historyData);
                            }
                        } catch (secErr) {
                            console.error('Check saved exercise error:', secErr);
                        }
                    }
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
                    <p className="mt-1 text-sm">This exercise could not be found in the catalog.</p>
                </div>
            </div>
        );
    }

    const hasInstructions = exercise.instructions?.length > 0;
    const hasTips = exercise.tips?.length > 0;
    const hasMistakes = exercise.common_mistakes?.length > 0;
    const hasMedia = Boolean(exercise.media_url ?? exercise.thumbnail_url);
    const hasTags = exercise.tags && exercise.tags.length > 0;
    const hasSecondary = secondaryMuscles.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                <Link
                    href="/fitness/exercises"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Exercises
                </Link>
                <Link
                    href="/fitness/body-map"
                    className="inline-block text-sm text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-300"
                >
                    View on Body Map
                </Link>
                <button
                    type="button"
                    onClick={async () => {
                        if (!exercise) return;
                        setSaving(true);
                        try {
                            if (isSaved) {
                                await unsaveExercise(exercise.id, supabase);
                                setIsSaved(false);
                            } else {
                                await saveExercise(exercise.id, supabase);
                                setIsSaved(true);
                            }
                        } catch (err) {
                            console.error('Toggle save exercise (detail) error:', err);
                        } finally {
                            setSaving(false);
                        }
                    }}
                    className={`ml-auto inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                        isSaved
                            ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                    disabled={saving}
                >
                    {saving ? 'Saving…' : isSaved ? 'Saved' : 'Save exercise'}
                </button>
            </div>

            <header>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {exercise.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {exercise.primary_muscle_group && (
                        <Link
                            href={`/fitness/muscles/${encodeURIComponent(exercise.primary_muscle_group.slug)}`}
                            className="inline-flex items-center rounded-full bg-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Primary muscle: {exercise.primary_muscle_group.name}
                        </Link>
                    )}
                </div>
            </header>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
                <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {exercise.primary_muscle_group?.name ?? 'Not available'}
                </span>
                {hasSecondary && (
                    <span className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Secondary:{' '}
                        {secondaryMuscles.map((m) => m.name).join(', ')}
                    </span>
                )}
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
                {hasTags &&
                    exercise.tags.map((tag) => (
                        <Link
                            key={tag}
                            href={`/fitness/exercises?tag=${encodeURIComponent(tag)}`}
                            className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                            #{tag}
                        </Link>
                    ))}
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
                    {hasSecondary && (
                        <div className="flex gap-2">
                            <dt className="text-slate-500 dark:text-slate-400 w-32 shrink-0">
                                Secondary muscles
                            </dt>
                            <dd className="text-slate-700 dark:text-slate-200">
                                {secondaryMuscles.map((m) => m.name).join(', ')}
                            </dd>
                        </div>
                    )}
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

            {history !== null && (
                <section>
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        Your recent performance
                    </h2>
                    {history.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            No logged sessions yet for this exercise.
                        </p>
                    ) : (
                        <>
                            {(() => {
                                const uniqueSessions = new Set(history.map((e) => e.session_id)).size;
                                const totalSets = history.reduce(
                                    (sum, e) => sum + (e.actual_sets_completed ?? 0),
                                    0
                                );
                                const latest = history[0];
                                const hasLastLogged =
                                    latest &&
                                    (latest.actual_sets_completed != null || latest.actual_avg_reps_per_set != null);
                                const bestSets = history.reduce(
                                    (best, e) =>
                                        e.actual_sets_completed != null
                                            ? Math.max(best, e.actual_sets_completed)
                                            : best,
                                    0
                                );
                                const bestAvgReps = history.reduce<number | null>(
                                    (best, e) => {
                                        if (e.actual_avg_reps_per_set == null) return best;
                                        return best == null
                                            ? e.actual_avg_reps_per_set
                                            : Math.max(best, e.actual_avg_reps_per_set);
                                    },
                                    null
                                );
                                const latestNote = latest?.actual_notes?.trim();
                                return (
                                    <div className="mb-3 space-y-2">
                                        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                                            <span>Completed sessions: {uniqueSessions}</span>
                                            {totalSets > 0 && <span>Total logged sets: {totalSets}</span>}
                                        </div>
                                        {(hasLastLogged || bestSets > 0 || bestAvgReps != null) && (
                                            <div className="flex flex-wrap gap-2">
                                                {hasLastLogged && (
                                                    <span className="rounded bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                        Last: {latest.actual_sets_completed != null && `${latest.actual_sets_completed} sets`}
                                                        {latest.actual_sets_completed != null && latest.actual_avg_reps_per_set != null && ', '}
                                                        {latest.actual_avg_reps_per_set != null && `~${latest.actual_avg_reps_per_set} reps/set`}
                                                    </span>
                                                )}
                                                {bestSets > 0 && (
                                                    <span className="rounded bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                        Best sets: {bestSets}
                                                    </span>
                                                )}
                                                {bestAvgReps != null && (
                                                    <span className="rounded bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                                        Best avg reps/set:{' '}
                                                        {Number.isInteger(bestAvgReps)
                                                            ? bestAvgReps
                                                            : bestAvgReps.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {latestNote && latest && (
                                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                                <span className="font-medium text-slate-500 dark:text-slate-500">Latest note: </span>
                                                <Link
                                                    href={`/fitness/sessions/${latest.session_id}`}
                                                    className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                                                >
                                                    {latestNote.length > 120 ? `${latestNote.slice(0, 120)}…` : latestNote}
                                                </Link>
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                            <ul className="space-y-2">
                                {(showAllHistory ? history : history.slice(0, 5)).map((entry, i) => (
                                    <li key={`${entry.session_id}-${i}`}>
                                        <Link
                                            href={`/fitness/sessions/${entry.session_id}`}
                                            className="block rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                                        >
                                            <div className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
                                                <span>
                                                    {new Date(entry.session_started_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                                {(entry.actual_sets_completed != null || entry.actual_avg_reps_per_set != null) && (
                                                    <span className="text-slate-600 dark:text-slate-300">
                                                        {entry.actual_sets_completed != null && `${entry.actual_sets_completed} sets`}
                                                        {entry.actual_sets_completed != null && entry.actual_avg_reps_per_set != null && ' · '}
                                                        {entry.actual_avg_reps_per_set != null && `~${entry.actual_avg_reps_per_set} reps/set`}
                                                    </span>
                                                )}
                                            </div>
                                            {entry.actual_notes && (
                                                <p className="mt-1 text-slate-600 dark:text-slate-400 line-clamp-2">
                                                    {entry.actual_notes}
                                                </p>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            {history.length > 5 && !showAllHistory && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllHistory(true)}
                                    className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                                >
                                    Show more ({history.length - 5} more)
                                </button>
                            )}
                        </>
                    )}
                </section>
            )}
        </div>
    );
}
