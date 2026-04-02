'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import type { WorkoutSession } from '@/lib/fitness/workoutSessions';
import {
    getProgressPageDataForUser,
    getSessionSummaries,
    type ProgressSummary,
    type SessionSummary,
} from '@/lib/fitness/workoutSessions';

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

function summaryLineForCard(summary: SessionSummary | undefined): string | null {
    if (!summary || summary.totalItems === 0) return null;
    if (summary.loggedItems === 0) return 'No actual performance logged';
    const parts = [`Logged ${summary.loggedItems} / ${summary.totalItems} exercises`];
    if (summary.totalSetsCompleted > 0) {
        parts.push(`${summary.totalSetsCompleted} total sets`);
    }
    return parts.join(' · ');
}

export default function ProgressClient() {
    const [summary, setSummary] = useState<ProgressSummary | null>(null);
    const [recent, setRecent] = useState<WorkoutSession[]>([]);
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

                const pageData = await getProgressPageDataForUser(user.id, supabase, 15);
                if (cancelled) return;
                setSummary(pageData.summary);
                setRecent(pageData.recentCompletedSessions);

                if (pageData.recentCompletedSessions.length > 0) {
                    const map = await getSessionSummaries(
                        pageData.recentCompletedSessions.map((s) => s.id),
                        supabase
                    );
                    if (!cancelled) setSummaries(map);
                } else {
                    setSummaries({});
                }
            } catch (e) {
                console.error('Progress page load error:', e);
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to load progress');
                    setSummary(null);
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
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progress</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4 pb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progress</h1>
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {error}
                </div>
            </div>
        );
    }

    const hasProgress =
        summary &&
        (summary.completedSessionsCount > 0 || summary.totalLoggedSets > 0 || summary.latestCompletedSession);

    return (
        <div className="space-y-6 pb-8">
            <header className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progress</h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Completed workout sessions and logged performance from your plans.
                </p>
            </header>

            {!hasProgress && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        No completed sessions yet. Start a plan-based workout, log your sets, then mark the session
                        complete.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
                        <Link
                            href="/fitness/plans"
                            className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                            Saved plans
                        </Link>
                        <Link
                            href="/fitness/sessions"
                            className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                            Sessions
                        </Link>
                        <Link
                            href="/fitness/workout-generator"
                            className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                            Workout generator
                        </Link>
                    </div>
                </div>
            )}

            {hasProgress && summary && (
                <>
                    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                            Progress summary
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Completed sessions</div>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {summary.completedSessionsCount}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">Last 100 completed</p>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Total logged sets</div>
                                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {summary.totalLoggedSets}
                                </div>
                            </div>
                            {summary.latestCompletedSession && (
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Latest workout</div>
                                    <Link
                                        href={`/fitness/sessions/${summary.latestCompletedSession.id}`}
                                        className="text-sm font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 truncate block"
                                    >
                                        {summary.latestCompletedSession.name || 'Session'}
                                    </Link>
                                    <div className="text-[11px] text-slate-500">
                                        {summary.latestCompletedSession.ended_at
                                            ? formatDateTime(summary.latestCompletedSession.ended_at)
                                            : '—'}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                            <Link
                                href="/fitness/sessions"
                                className="font-medium text-amber-600 hover:text-amber-500 dark:text-amber-400"
                            >
                                View all sessions
                            </Link>
                        </div>
                    </section>

                    {recent.length > 0 && (
                        <section className="space-y-3">
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Recent completed sessions
                            </h2>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0">
                                {recent.map((s) => {
                                    const cardSummary = summaries[s.id];
                                    const line = summaryLineForCard(cardSummary);
                                    return (
                                        <li key={s.id}>
                                            <Link
                                                href={`/fitness/sessions/${s.id}`}
                                                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-amber-500/60 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-amber-400/60 dark:hover:bg-slate-800"
                                            >
                                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                                    {s.name || 'Workout Session'}
                                                </h3>
                                                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                    {formatDateTime(s.started_at)}
                                                    {s.ended_at && ` → ${formatDateTime(s.ended_at)}`}
                                                </p>
                                                {line && (
                                                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                                                        {line}
                                                    </p>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
