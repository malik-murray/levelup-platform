'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type { WorkoutSession } from '@/lib/fitness/workoutSessions';
import { listInProgressSessionsForUser, listRecentSessionsForUser, getSessionSummaries, type SessionSummary } from '@/lib/fitness/workoutSessions';

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function SessionsListClient() {
    const [inProgress, setInProgress] = useState<WorkoutSession[] | null>(null);
    const [recent, setRecent] = useState<WorkoutSession[] | null>(null);
    const [summaries, setSummaries] = useState<Record<string, SessionSummary>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

                const [inProgressSessions, recentSessions] = await Promise.all([
                    listInProgressSessionsForUser(user.id, supabase),
                    listRecentSessionsForUser(user.id, supabase),
                ]);

                if (cancelled) return;
                setInProgress(inProgressSessions);
                setRecent(recentSessions);

                if (recentSessions.length > 0) {
                    const summaryMap = await getSessionSummaries(
                        recentSessions.map((ss) => ss.id),
                        supabase
                    );
                    if (!cancelled) setSummaries(summaryMap);
                } else {
                    setSummaries({});
                }
            } catch (e) {
                console.error('Error loading sessions:', e);
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load sessions');
                    setInProgress([]);
                    setRecent([]);
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

    if (loading) {
        return (
            <div className="space-y-4 pb-8">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Workout Sessions
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading sessions…</p>
            </div>
        );
    }

    const hasInProgress = inProgress && inProgress.length > 0;
    const hasRecent = recent && recent.length > 0;
    const hasAny = hasInProgress || hasRecent;

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <Link
                    href="/fitness/plans"
                    className="inline-block text-sm text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                >
                    ← Back to Plans
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Workout Sessions
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    View in-progress and recent sessions you&apos;ve started from your workout plans.
                </p>
            </header>

            {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            )}

            {!error && !hasAny && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <p>You don&apos;t have any sessions yet.</p>
                    <p className="mt-2">
                        <Link
                            href="/fitness/plans"
                            className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                            Open your plans
                        </Link>
                        {' '}and start a session to begin.
                    </p>
                </div>
            )}

            {hasInProgress && (
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        In progress
                    </h2>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                        {inProgress!.map((s) => (
                            <li key={s.id}>
                                <div className="flex flex-col rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/60 shadow-sm">
                                    <Link
                                        href={`/fitness/sessions/${s.id}`}
                                        className="block p-4 flex-1 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 rounded-t-lg transition-colors"
                                    >
                                        <h3 className="font-semibold text-slate-900 dark:text-white">
                                            {s.name || 'Workout Session'}
                                        </h3>
                                        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                            Started {formatDateTime(s.started_at)}
                                        </p>
                                    </Link>
                                    <div className="px-4 pb-4 pt-0">
                                        <Link
                                            href={`/fitness/sessions/${s.id}`}
                                            className="block w-full rounded-md bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-black dark:hover:bg-emerald-400"
                                        >
                                            Continue session
                                        </Link>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {hasRecent && (
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Recent history
                    </h2>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
                        {recent!.map((s) => {
                            const summary = summaries[s.id];
                            const summaryLine =
                                summary && summary.totalItems > 0
                                    ? summary.loggedItems === 0
                                        ? 'No actual performance logged'
                                        : [
                                            `Logged ${summary.loggedItems} / ${summary.totalItems} exercises`,
                                            summary.totalSetsCompleted > 0 && `${summary.totalSetsCompleted} total sets`,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')
                                    : null;
                            return (
                                <li key={s.id}>
                                    <Link
                                        href={`/fitness/sessions/${s.id}`}
                                        className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-amber-500/60 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-400/60 dark:hover:bg-slate-800"
                                    >
                                        <h3 className="font-semibold text-slate-900 dark:text-white">
                                            {s.name || 'Workout Session'}
                                        </h3>
                                        <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-200">
                                            Status: {s.status}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                            Started: {formatDateTime(s.started_at)}
                                        </p>
                                        {s.ended_at && (
                                            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                Ended: {formatDateTime(s.ended_at)}
                                            </p>
                                        )}
                                        {summaryLine && (
                                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                                                {summaryLine}
                                            </p>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </div>
    );
}

