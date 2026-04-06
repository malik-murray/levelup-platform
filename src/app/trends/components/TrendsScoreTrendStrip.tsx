'use client';

import { neon } from '@/app/dashboard/neonTheme';

type Props = {
    priorLabel: string;
    overallDelta: number | null;
    habitDelta: number | null;
};

function Delta({ label, delta }: { label: string; delta: number | null }) {
    if (delta == null) {
        return (
            <span className="text-slate-400">
                {label}: <span className="tabular-nums text-slate-600">—</span>
            </span>
        );
    }
    const up = delta > 0;
    const down = delta < 0;
    const arrow = up ? '↑' : down ? '↓' : '→';
    const color = up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-400';
    return (
        <span className={color}>
            {label}: {arrow}{' '}
            <span className="font-semibold tabular-nums">{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span>
            <span className="font-normal text-slate-500"> pts</span>
        </span>
    );
}

export default function TrendsScoreTrendStrip({ priorLabel, overallDelta, habitDelta }: Props) {
    return (
        <div
            className={`${neon.section} mx-auto flex max-w-lg flex-col items-center gap-1 px-4 py-3 text-center text-xs sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-1`}
            role="status"
        >
            <span className="text-slate-400">vs {priorLabel}</span>
            <Delta label="Overall" delta={overallDelta} />
            <span className="hidden text-[#ff9d00]/25 sm:inline" aria-hidden>
                |
            </span>
            <Delta label="Habit" delta={habitDelta} />
        </div>
    );
}
