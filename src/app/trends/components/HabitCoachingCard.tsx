'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { HabitCoachBundle } from '@/lib/trends/habitCoaching';
import type { HabitTrend } from '@/lib/trends/trendsPageTypes';
import { trendsHabitCoach } from '@/lib/trends/trendsCopy';
import { questTrendBadgeAria, questTrendBadgeDisplay } from '@/lib/trends/trendsCopy';

type Props = {
    habit: HabitTrend;
    bundle: HabitCoachBundle;
};

export default function HabitCoachingCard({ habit, bundle }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-2xl border border-[#ff9d00]/40 bg-black/45 p-4 backdrop-blur-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="text-2xl" aria-hidden>
                        {habit.icon}
                    </span>
                    <div className="min-w-0">
                        <h3 className="truncate font-bold text-white">{habit.name}</h3>
                        <p className="text-xs uppercase tracking-wider text-slate-500">{habit.category}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200">
                        {bundle.statusLabel}
                    </span>
                    <span
                        className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-200"
                        aria-label={questTrendBadgeAria(habit.trend, habit.trendDelta)}
                    >
                        {questTrendBadgeDisplay(habit.trend, habit.trendDelta)}
                    </span>
                </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#ff9d00]/80">
                    {trendsHabitCoach.coachNoteEyebrow}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">{bundle.coachNote}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <Link
                    href={`/habit/${habit.id}/edit`}
                    className="inline-flex rounded-full border border-[#ff9d00]/45 bg-[#ff9d00]/15 px-4 py-2 text-sm font-semibold text-[#ffe066] hover:bg-[#ff9d00]/25"
                >
                    {bundle.ctaLabel}
                </Link>
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                    {trendsHabitCoach.signalsToggle}
                </button>
            </div>

            {open && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3">
                        <p className="text-xs font-semibold text-emerald-300">{trendsHabitCoach.momentumBadge}</p>
                        <ul className="mt-2 space-y-1 text-xs text-emerald-100/90">
                            {habit.positiveSignals.length === 0 ? (
                                <li className="text-slate-500">—</li>
                            ) : (
                                habit.positiveSignals.map((s) => <li key={s}>+ {s}</li>)
                            )}
                        </ul>
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-950/15 p-3">
                        <p className="text-xs font-semibold text-rose-300">Drains</p>
                        <ul className="mt-2 space-y-1 text-xs text-rose-100/90">
                            {habit.negativeSignals.length === 0 ? (
                                <li className="text-slate-500">—</li>
                            ) : (
                                habit.negativeSignals.map((s) => <li key={s}>− {s}</li>)
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
