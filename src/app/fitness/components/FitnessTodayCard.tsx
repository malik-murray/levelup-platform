'use client';

import Link from 'next/link';
import type { FitnessTodaySnapshot } from '@/lib/fitness/dailySnapshot';

type ProgramAssignment = {
    scheduleEntryId: string;
    planId: string;
    dayIndex: number;
    scheduledDate: string;
    carryForward: boolean;
};

type InProgressSession = {
    id: string;
    name: string | null;
    started_at: string;
};

type FitnessTodayCardProps = {
    snapshot: FitnessTodaySnapshot | null;
    snapshotLoading: boolean;
    programAssignment: ProgramAssignment | null;
    inProgressSession: InProgressSession | null;
    startingScheduledWorkout: boolean;
    onStartScheduledWorkout: () => void;
    /** When true, omit outer card chrome (for embedding in dashboard widgets). */
    embedded?: boolean;
    /** Date shown in the header; defaults to today. */
    selectedDate?: Date;
};

function formatMetric(value: number | null | undefined, suffix = ''): string {
    if (value == null) return '—';
    return `${value.toLocaleString()}${suffix}`;
}

export default function FitnessTodayCard({
    snapshot,
    snapshotLoading,
    programAssignment,
    inProgressSession,
    startingScheduledWorkout,
    onStartScheduledWorkout,
    embedded = false,
    selectedDate,
}: FitnessTodayCardProps) {
    const streak = snapshot?.streak;
    const metrics = snapshot?.metrics;
    const nutrition = snapshot?.nutrition;
    const displayDate = selectedDate ?? new Date();
    const isToday =
        displayDate.getFullYear() === new Date().getFullYear() &&
        displayDate.getMonth() === new Date().getMonth() &&
        displayDate.getDate() === new Date().getDate();

    const outerClass = embedded
        ? 'space-y-3'
        : 'rounded-xl border border-zinc-700/60 bg-zinc-900/80 p-4 shadow-lg backdrop-blur-sm';

    return (
        <section className={outerClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-white">{isToday ? 'Today' : 'Day overview'}</h2>
                    <p className="text-[11px] text-zinc-400">
                        {displayDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                        })}
                    </p>
                </div>
                {snapshotLoading ? (
                    <span className="text-[11px] text-zinc-500">Loading…</span>
                ) : streak ? (
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300">
                            {streak.currentStreak > 0
                                ? `${streak.currentStreak}-day streak`
                                : 'Start your streak'}
                        </span>
                        {streak.trainedToday && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                                Trained today
                            </span>
                        )}
                    </div>
                ) : null}
            </div>

            <div className="space-y-3">
                {inProgressSession ? (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                            In progress
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-white">
                            {inProgressSession.name || 'Workout session'}
                        </p>
                        <Link
                            href={`/fitness/sessions/${inProgressSession.id}`}
                            className="mt-2 inline-block rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
                        >
                            Continue session
                        </Link>
                    </div>
                ) : programAssignment ? (
                    <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                            Scheduled workout
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-white">
                            Day {programAssignment.dayIndex}
                            {programAssignment.carryForward ? ' (carry-forward)' : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={startingScheduledWorkout}
                                onClick={onStartScheduledWorkout}
                                className="rounded-md bg-indigo-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-indigo-300 disabled:opacity-60"
                            >
                                {startingScheduledWorkout ? 'Starting…' : "Start today's workout"}
                            </button>
                            <Link
                                href={`/fitness/plans/${programAssignment.planId}`}
                                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                            >
                                View plan
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-3">
                        <p className="text-xs text-zinc-400">No workout scheduled for today.</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            <Link
                                href="/fitness/workouts"
                                className="inline-block text-xs font-medium text-amber-400 hover:text-amber-300"
                            >
                                Quick log a workout →
                            </Link>
                            <Link
                                href="/fitness/plans"
                                className="inline-block text-xs font-medium text-amber-400 hover:text-amber-300"
                            >
                                Generate a training plan →
                            </Link>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MetricPill
                        label="Weight"
                        value={
                            metrics?.weight_kg != null
                                ? `${metrics.weight_kg} kg`
                                : '—'
                        }
                        href="/fitness/metrics"
                    />
                    <MetricPill
                        label="Steps"
                        value={formatMetric(metrics?.steps)}
                        href="/fitness/metrics"
                    />
                    <MetricPill
                        label="Water"
                        value={
                            metrics?.water_ml != null
                                ? `${(metrics.water_ml / 1000).toFixed(1)} L`
                                : '—'
                        }
                        href="/fitness/metrics"
                    />
                    <MetricPill
                        label="Sleep"
                        value={
                            metrics?.sleep_hours != null
                                ? `${metrics.sleep_hours}h`
                                : '—'
                        }
                        href="/fitness/metrics"
                    />
                </div>

                <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            Nutrition
                        </p>
                        <Link
                            href="/fitness/meals"
                            className="text-[10px] font-medium text-amber-400 hover:text-amber-300"
                        >
                            Log meal
                        </Link>
                    </div>
                    {snapshotLoading ? (
                        <p className="mt-1 text-xs text-zinc-500">Loading…</p>
                    ) : (
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-200">
                            <span>
                                <span className="text-zinc-400">Calories:</span>{' '}
                                {nutrition && nutrition.calories > 0
                                    ? nutrition.calories.toLocaleString()
                                    : '—'}
                            </span>
                            <span>
                                <span className="text-zinc-400">Protein:</span>{' '}
                                {nutrition && nutrition.protein_g > 0
                                    ? `${Math.round(nutrition.protein_g)}g`
                                    : '—'}
                            </span>
                            <span>
                                <span className="text-zinc-400">Meals:</span>{' '}
                                {nutrition?.meal_count ?? 0}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function MetricPill({
    label,
    value,
    href,
}: {
    label: string;
    value: string;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-2 transition hover:border-amber-500/30 hover:bg-zinc-800/60"
        >
            <p className="text-[10px] font-medium text-zinc-500">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
        </Link>
    );
}
