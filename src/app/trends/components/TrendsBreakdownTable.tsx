'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { neon } from '@/app/dashboard/neonTheme';
import type { HabitBreakdownRow } from '@/lib/trends/trendsHabitBreakdown';
import { scoreTierColor } from '@/lib/trends/trendsScoreRing';

type SortKey = 'pctAsc' | 'pctDesc' | 'name';

function fmtRatio(c: number): string {
    const r = Math.round(c * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

type Props = {
    rows: HabitBreakdownRow[];
};

export default function TrendsBreakdownTable({ rows }: Props) {
    const [sort, setSort] = useState<SortKey>('pctAsc');

    const sorted = useMemo(() => {
        const copy = [...rows];
        if (sort === 'name') {
            copy.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sort === 'pctDesc') {
            copy.sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
        } else {
            copy.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
        }
        return copy;
    }, [rows, sort]);

    if (rows.length === 0) {
        return (
            <p className={`${neon.section} px-4 py-8 text-center text-sm text-slate-400`}>
                No active habits to show. Add habits from the habit tracker.
            </p>
        );
    }

    return (
        <div className={`${neon.panel} overflow-x-auto p-0`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ff9d00]/25 bg-black/20 px-3 py-2">
                <span className="text-xs font-semibold text-[#ff9d00]/85">Sort</span>
                <div className={`${neon.trendsPillRow} max-w-full border-0 bg-transparent p-0 shadow-none`}>
                    <button
                        type="button"
                        onClick={() => setSort('pctAsc')}
                        className={sort === 'pctAsc' ? neon.trendsPillOn : neon.trendsPillOff}
                    >
                        Weakest first
                    </button>
                    <button
                        type="button"
                        onClick={() => setSort('pctDesc')}
                        className={sort === 'pctDesc' ? neon.trendsPillOn : neon.trendsPillOff}
                    >
                        Strongest first
                    </button>
                    <button
                        type="button"
                        onClick={() => setSort('name')}
                        className={sort === 'name' ? neon.trendsPillOn : neon.trendsPillOff}
                    >
                        Name A–Z
                    </button>
                </div>
            </div>
            <table className="w-full min-w-[320px] text-left text-sm text-slate-200">
                <thead>
                    <tr className="border-b border-[#ff9d00]/20 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2 font-semibold">Habit</th>
                        <th className="hidden px-3 py-2 font-semibold sm:table-cell">Lane</th>
                        <th className="hidden px-3 py-2 font-semibold md:table-cell">Time</th>
                        <th className="px-3 py-2 text-right font-semibold">Done</th>
                        <th className="px-3 py-2 text-right font-semibold">%</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((r) => (
                        <tr
                            key={r.id}
                            className="border-b border-[#ff9d00]/10 last:border-0 hover:bg-[#ff9d00]/5"
                        >
                            <td className="min-w-0 px-3 py-2 align-top">
                                <Link
                                    href={`/habit/${r.id}/edit`}
                                    className="inline-flex min-w-0 max-w-full items-start gap-2 font-medium text-white hover:text-[#ffe066] hover:underline"
                                >
                                    <span className="shrink-0 text-base" aria-hidden>
                                        {r.icon}
                                    </span>
                                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{r.name}</span>
                                </Link>
                                <div className="mt-0.5 text-[10px] text-slate-500 sm:hidden">
                                    {r.category} · {r.timeLabel}
                                </div>
                            </td>
                            <td className="hidden px-3 py-2 capitalize text-slate-400 sm:table-cell">{r.category}</td>
                            <td className="hidden px-3 py-2 text-slate-400 md:table-cell">{r.timeLabel}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                                {fmtRatio(r.completed)}/{r.total}
                            </td>
                            <td className="px-3 py-2 text-right">
                                <span
                                    className="font-semibold tabular-nums"
                                    style={{ color: scoreTierColor(r.pct) }}
                                >
                                    {r.pct.toFixed(1)}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
