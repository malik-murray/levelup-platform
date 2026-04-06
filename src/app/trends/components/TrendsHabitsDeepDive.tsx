'use client';

import { useState } from 'react';
import Link from 'next/link';
import CollapsiblePanel from '@/app/dashboard/components/CollapsiblePanel';
import type { HabitTrend } from '@/lib/trends/trendsPageTypes';
import { trendsLayout, trendsQuestCard, questTrendBadgeAria, questTrendBadgeDisplay } from '@/lib/trends/trendsCopy';
import type { LaneFilter } from '@/lib/trends/trendsPageTypes';

type Props = {
    habits: HabitTrend[];
    laneFilter: LaneFilter;
};

export default function TrendsHabitsDeepDive({ habits, laneFilter }: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (habits.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">
                {laneFilter === 'all'
                    ? trendsQuestCard.emptyAll
                    : trendsQuestCard.emptyFiltered(laneFilter)}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div>
                <h4 className="text-sm font-bold text-[#ffe066]">{trendsLayout.groupQuestsHeading}</h4>
                <p className="mt-1 text-xs text-slate-400">{trendsLayout.groupQuestsSub}</p>
            </div>
            <ul className="space-y-3">
                {habits.map((t) => {
                    const open = expanded === t.id;
                    return (
                        <li
                            key={t.id}
                            className="rounded-xl border border-white/10 bg-black/40 p-4"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="text-xl" aria-hidden>
                                        {t.icon}
                                    </span>
                                    <div className="min-w-0">
                                        <Link
                                            href={`/habit/${t.id}/edit`}
                                            className="font-semibold text-white hover:text-[#ffe066]"
                                        >
                                            {t.name}
                                        </Link>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500">
                                            {t.category}
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-200"
                                    aria-label={questTrendBadgeAria(t.trend, t.trendDelta)}
                                >
                                    {questTrendBadgeDisplay(t.trend, t.trendDelta)}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                <div>
                                    <p className="text-slate-500">{trendsQuestCard.statMomentum}</p>
                                    <p className="font-semibold text-slate-200">{t.completionRate}%</p>
                                    <p className="text-[10px] text-slate-500">{trendsQuestCard.statMomentumHint}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">{trendsQuestCard.statClears}</p>
                                    <p className="font-semibold text-slate-200">
                                        {t.completedDays}/{t.totalDays}
                                    </p>
                                    <p className="text-[10px] text-slate-500">{trendsQuestCard.statClearsHint}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">{trendsQuestCard.statStreakPower}</p>
                                    <p className="font-semibold text-slate-200">{t.currentStreak}d</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">{trendsQuestCard.statBestRun}</p>
                                    <p className="font-semibold text-slate-200">{t.longestStreak}d</p>
                                </div>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                                    style={{ width: `${t.completionRate}%` }}
                                    aria-label={trendsQuestCard.barAria(t.completionRate)}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setExpanded(open ? null : t.id)}
                                className="mt-3 text-xs font-medium text-[#ff9d00] hover:text-[#ffe066]"
                            >
                                {trendsQuestCard.performanceBuffs} / {trendsQuestCard.performanceDrains}
                            </button>
                            <CollapsiblePanel open={open}>
                                <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 md:grid-cols-2">
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-300">
                                            {trendsQuestCard.performanceBuffs}
                                        </p>
                                        <ul className="mt-1 space-y-1 text-xs text-slate-300">
                                            {t.positiveSignals.length === 0 ? (
                                                <li className="text-slate-500">{trendsQuestCard.noBuffsYet}</li>
                                            ) : (
                                                t.positiveSignals.map((s) => <li key={s}>+ {s}</li>)
                                            )}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-rose-300">
                                            {trendsQuestCard.performanceDrains}
                                        </p>
                                        <ul className="mt-1 space-y-1 text-xs text-slate-300">
                                            {t.negativeSignals.length === 0 ? (
                                                <li className="text-slate-500">{trendsQuestCard.noDrains}</li>
                                            ) : (
                                                t.negativeSignals.map((s) => <li key={s}>− {s}</li>)
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </CollapsiblePanel>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
