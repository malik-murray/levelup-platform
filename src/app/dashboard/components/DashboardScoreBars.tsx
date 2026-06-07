'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type DashboardScores = {
    score_overall: number;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
    score_physical: number;
    score_mental: number;
    score_spiritual: number;
    score_morning: number;
    score_afternoon: number;
    score_evening: number;
    grade?: string;
};

const BAR_CONFIG = [
    { key: 'score_overall' as const, label: 'Overall Score', color: 'from-[#ff5a00] to-[#ffea8a]', trackBg: 'bg-black/40', textColor: 'text-[#ffcc66]' },
    { key: 'score_priorities' as const, label: 'Priority Score', color: 'from-[#a855f7] to-[#e9d5ff]', trackBg: 'bg-black/40', textColor: 'text-[#d8b4fe]' },
    { key: 'score_habits' as const, label: 'Habit Score', color: 'from-[#3b82f6] to-[#93c5fd]', trackBg: 'bg-black/40', textColor: 'text-[#93c5fd]' },
    { key: 'score_todos' as const, label: 'To-Do List Score', color: 'from-[#10b981] to-[#a7f3d0]', trackBg: 'bg-black/40', textColor: 'text-[#6ee7b7]' },
    { key: 'score_morning' as const, label: 'Morning Score', color: 'from-[#f59e0b] to-[#fde68a]', trackBg: 'bg-black/40', textColor: 'text-[#fcd34d]' },
    { key: 'score_afternoon' as const, label: 'Afternoon Score', color: 'from-[#ea580c] to-[#fdba74]', trackBg: 'bg-black/40', textColor: 'text-[#fb923c]' },
    { key: 'score_evening' as const, label: 'Evening Score', color: 'from-[#c2410c] to-[#fed7aa]', trackBg: 'bg-black/40', textColor: 'text-[#fdba74]' },
    { key: 'score_mental' as const, label: 'Mental Score', color: 'from-[#9333ea] to-[#d8b4fe]', trackBg: 'bg-black/40', textColor: 'text-[#c084fc]' },
    { key: 'score_physical' as const, label: 'Physical Score', color: 'from-[#2563eb] to-[#93c5fd]', trackBg: 'bg-black/40', textColor: 'text-[#60a5fa]' },
    { key: 'score_spiritual' as const, label: 'Spiritual Score', color: 'from-[#d97706] to-[#fde68a]', trackBg: 'bg-black/40', textColor: 'text-[#fbbf24]' },
] as const;

export default function DashboardScoreBars({ scores }: { scores: DashboardScores | null }) {
    const [activeGlowKeys, setActiveGlowKeys] = useState<Record<string, boolean>>({});
    const prevScoresRef = useRef<DashboardScores | null>(null);

    const scoreKey = useMemo(
        () =>
            scores
                ? BAR_CONFIG.map(({ key }) => `${key}:${Math.round(Math.min(100, Math.max(0, scores[key])))}`).join('|')
                : null,
        [scores],
    );

    useEffect(() => {
        if (!scores) {
            prevScoresRef.current = null;
            return;
        }

        const prev = prevScoresRef.current;
        prevScoresRef.current = scores;
        if (!prev) return;

        const changed = BAR_CONFIG.filter(({ key }) => Math.round(prev[key]) !== Math.round(scores[key])).map(
            ({ key }) => key,
        );
        if (changed.length === 0) return;

        setActiveGlowKeys((old) => {
            const next = { ...old };
            for (const key of changed) next[key] = true;
            return next;
        });

        const timeout = window.setTimeout(() => {
            setActiveGlowKeys((old) => {
                const next = { ...old };
                for (const key of changed) next[key] = false;
                return next;
            });
        }, 950);

        return () => window.clearTimeout(timeout);
    }, [scoreKey, scores]);

    if (!scores) {
        return (
            <div className="grid w-full grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {BAR_CONFIG.map(({ key, label, trackBg }) => (
                    <div key={key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">{label}</span>
                            <span className="text-xs font-mono text-slate-500">—%</span>
                        </div>
                        <div className={`relative h-7 overflow-hidden rounded-lg border border-[#ff9d00]/30 ${trackBg}`}>
                            <div className="absolute inset-y-0 right-0 w-3 flex items-stretch finish-line rounded-r-lg" aria-hidden />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid w-full grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {BAR_CONFIG.map(({ key, label, color, trackBg, textColor }) => {
                const value = scores[key];
                const pct = Math.min(100, Math.max(0, value));
                const glowOn = Boolean(activeGlowKeys[key]);
                return (
                    <div key={key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">{label}</span>
                            <span
                                className={`text-sm font-bold tabular-nums transition-all duration-500 ${textColor} ${glowOn ? 'score-change-pulse' : ''}`}
                            >
                                {pct}%
                            </span>
                        </div>
                        <div
                            className={`relative h-7 overflow-hidden rounded-lg border border-[#ff9d00]/30 transition-shadow duration-500 ${trackBg} ${glowOn ? 'score-change-glow' : ''}`}
                        >
                            <div
                                className={`absolute inset-y-0 left-0 rounded-l-lg bg-gradient-to-r ${color} transition-all duration-500 ease-out`}
                                style={{ width: `${pct}%` }}
                            />
                            <div
                                className="absolute inset-y-0 right-0 w-3 flex items-stretch finish-line rounded-r-lg"
                                aria-hidden
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
