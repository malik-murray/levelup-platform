'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { neon } from '@/app/dashboard/neonTheme';
import type { HabitMomentumRow } from '@/lib/trends/trendsHabitMomentum';
import type { StreaksPageReadyModel } from '@/app/trends/useStreaksPageData';

type Props = {
    model: StreaksPageReadyModel;
};

type StreakScope = 'current' | 'longest';
type StreakFilter = 'all' | 'good' | 'bad';

const SCOPE_TABS: { id: StreakScope; label: string }[] = [
    { id: 'current', label: 'Current' },
    { id: 'longest', label: 'Longest' },
];

const STREAK_FILTERS: { id: StreakFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'good', label: 'Good' },
    { id: 'bad', label: 'Bad' },
];

function HabitStreakCard({
    row,
    variant,
    scope,
}: {
    row: HabitMomentumRow;
    variant: 'good' | 'bad';
    scope: StreakScope;
}) {
    const streakDays =
        variant === 'good'
            ? scope === 'current'
                ? row.currentGoodStreak
                : row.longestGoodStreak
            : scope === 'current'
              ? row.currentMissStreak
              : row.longestMissStreak;
    const tone = variant === 'good' ? 'text-emerald-200' : 'text-rose-200';

    return (
        <Link
            href={`/habit/${row.id}/edit`}
            className={`${neon.section} flex items-center gap-3 px-3 py-2.5 transition-colors hover:border-[#ff9d00]/55 hover:bg-[#ff9d00]/5`}
        >
            <span className="text-xl" aria-hidden>
                {row.icon}
            </span>
            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <span className="min-w-0 max-w-full break-words font-medium text-white [overflow-wrap:anywhere]">
                        {row.name}
                    </span>
                    <span
                        className={`shrink-0 text-lg font-extrabold tabular-nums ${tone}`}
                        aria-label={`${streakDays} day streak`}
                    >
                        {streakDays}
                        <span className="ml-0.5 text-xs font-semibold text-slate-500">d</span>
                    </span>
                </p>
                <p className="text-[10px] text-slate-500">
                    {row.category} · {row.timeLabel}
                </p>
            </div>
        </Link>
    );
}

export default function TrendsStreaksPageContent({ model }: Props) {
    const [streakScope, setStreakScope] = useState<StreakScope>('current');
    const [streakFilter, setStreakFilter] = useState<StreakFilter>('all');
    const { habitMomentumRows } = model;

    const goodSorted = useMemo(() => {
        const copy = [...habitMomentumRows];
        if (streakScope === 'current') {
            copy.sort(
                (a, b) =>
                    b.currentGoodStreak - a.currentGoodStreak ||
                    b.longestGoodStreak - a.longestGoodStreak ||
                    a.name.localeCompare(b.name),
            );
        } else {
            copy.sort(
                (a, b) =>
                    b.longestGoodStreak - a.longestGoodStreak ||
                    b.currentGoodStreak - a.currentGoodStreak ||
                    a.name.localeCompare(b.name),
            );
        }
        return copy;
    }, [habitMomentumRows, streakScope]);

    const badSorted = useMemo(() => {
        const copy =
            streakScope === 'current'
                ? habitMomentumRows.filter((r) => r.currentMissStreak >= 1)
                : habitMomentumRows.filter((r) => r.longestMissStreak >= 1);
        if (streakScope === 'current') {
            copy.sort(
                (a, b) =>
                    b.currentMissStreak - a.currentMissStreak ||
                    b.longestMissStreak - a.longestMissStreak ||
                    a.name.localeCompare(b.name),
            );
        } else {
            copy.sort(
                (a, b) =>
                    b.longestMissStreak - a.longestMissStreak ||
                    b.currentMissStreak - a.currentMissStreak ||
                    a.name.localeCompare(b.name),
            );
        }
        return copy;
    }, [habitMomentumRows, streakScope]);

    return (
        <main className="min-w-0 space-y-8 px-4 py-8 pb-12 lg:px-8">
            <div className={`${neon.widget} mx-auto max-w-2xl space-y-4 p-4 sm:p-5`}>
                <div
                    className={`${neon.trendsPillRow} justify-center sm:justify-start`}
                    role="tablist"
                    aria-label="Streak type"
                >
                    {SCOPE_TABS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            role="tab"
                            aria-selected={streakScope === f.id}
                            onClick={() => setStreakScope(f.id)}
                            className={streakScope === f.id ? neon.trendsPillOn : neon.trendsPillOff}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div
                    className={`${neon.trendsPillRow} justify-center sm:justify-start`}
                    role="group"
                    aria-label="Good or bad streaks"
                >
                    {STREAK_FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setStreakFilter(f.id)}
                            className={streakFilter === f.id ? neon.trendsPillOn : neon.trendsPillOff}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mx-auto max-w-2xl space-y-10">
                {(streakFilter === 'all' || streakFilter === 'good') && (
                    <section className="space-y-3">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/90">
                            Good streaks
                        </h2>
                        {goodSorted.length === 0 ? (
                            <p className={`${neon.section} px-4 py-6 text-center text-sm text-slate-400`}>
                                No active habits. Add habits from the habit tracker.
                            </p>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {goodSorted.map((row) => (
                                    <HabitStreakCard
                                        key={row.id}
                                        row={row}
                                        variant="good"
                                        scope={streakScope}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {(streakFilter === 'all' || streakFilter === 'bad') && (
                    <section className="space-y-3">
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-300/90">
                            Bad streaks
                        </h2>
                        {badSorted.length === 0 ? (
                            <p className={`${neon.section} px-4 py-6 text-center text-sm text-slate-400`}>
                                {streakScope === 'current'
                                    ? 'No habits are on a miss streak from today.'
                                    : 'No miss streaks in your history yet.'}
                            </p>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {badSorted.map((row) => (
                                    <HabitStreakCard
                                        key={row.id}
                                        row={row}
                                        variant="bad"
                                        scope={streakScope}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
}
