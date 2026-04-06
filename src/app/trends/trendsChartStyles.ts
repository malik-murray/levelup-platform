import type { CSSProperties } from 'react';

export const trendsChartTooltipStyle: CSSProperties = {
    background: 'rgba(6,10,20,0.94)',
    border: '1px solid rgba(255,157,0,0.35)',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 12,
    color: '#f1f5f9',
    boxShadow: '0 0 24px rgba(255,157,0,0.15)',
};

export const axisTick = { fill: '#94a3b8', fontSize: 11 };

export function filterPillClass(active: boolean): string {
    return active
        ? 'border-[#ff9d00]/60 bg-[#ff9d00]/15 text-[#ffe066] shadow-[0_0_16px_rgba(255,157,0,0.2)]'
        : 'border-white/10 bg-black/30 text-slate-300 hover:border-[#ff9d00]/25 hover:bg-[#ff9d00]/5';
}

export const chartShellClass =
    'min-w-0 rounded-xl border border-[#ff9d00]/35 bg-[#060a14]/80 p-3 sm:p-4 shadow-[inset_0_0_24px_rgba(255,157,0,0.04)]';

export const spineColors = {
    coreMeter: '#ffea8a',
    habitXp: '#38bdf8',
    priorityLane: '#c084fc',
    questClears: '#34d399',
} as const;

export const rhythmColors = {
    morning: '#fcd34d',
    afternoon: '#fb923c',
    evening: '#a78bfa',
} as const;

export const laneColors = {
    physical: '#22d3ee',
    mental: '#e879f9',
    spiritual: '#fbbf24',
} as const;
