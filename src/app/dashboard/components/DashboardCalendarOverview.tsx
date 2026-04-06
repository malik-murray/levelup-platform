'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate, getGrade, getMonthRange, getDatesInMonth, isSameDay } from '@/lib/habitHelpers';
import { neon } from '../neonTheme';

type DayScore = {
    date: string;
    grade: string;
    score_overall: number;
};

export default function DashboardCalendarOverview({
    userId,
    selectedDate,
    onSelectDate,
    onClose,
}: {
    userId: string | null;
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    onClose: () => void;
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
    const [scoresByDate, setScoresByDate] = useState<Map<string, DayScore>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        const { start, end } = getMonthRange(currentMonth);
        const startStr = formatDate(start);
        const endStr = formatDate(end);
        setLoading(true);

        (async () => {
            try {
                const { data } = await supabase
                    .from('habit_daily_scores')
                    .select('date, grade, score_overall')
                    .eq('user_id', userId)
                    .gte('date', startStr)
                    .lte('date', endStr);

                const map = new Map<string, DayScore>();
                data?.forEach((row: { date: string; grade: string; score_overall: number }) => {
                    map.set(row.date, { date: row.date, grade: row.grade, score_overall: row.score_overall });
                });
                setScoresByDate(map);
            } finally {
                setLoading(false);
            }
        })();
    }, [userId, currentMonth]);

    const calendarDays = getDatesInMonth(currentMonth).map((date) => ({
        date,
        score: scoresByDate.get(formatDate(date)) ?? null,
    }));

    let monthOverallSum = 0;
    let monthOverallCount = 0;
    for (const { score } of calendarDays) {
        if (score) {
            monthOverallSum += score.score_overall;
            monthOverallCount += 1;
        }
    }
    const monthOverallPct =
        monthOverallCount > 0 ? Math.round(monthOverallSum / monthOverallCount) : null;
    const monthOverall =
        monthOverallPct !== null
            ? { percent: monthOverallPct, grade: getGrade(monthOverallPct) }
            : null;

    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startOffset = firstDay.getDay();

    const handlePrevMonth = () => {
        setCurrentMonth((prev) => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() - 1);
            return next;
        });
    };
    const handleNextMonth = () => {
        setCurrentMonth((prev) => {
            const next = new Date(prev);
            next.setMonth(prev.getMonth() + 1);
            return next;
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className={`${neon.panel} max-h-[90vh] w-full max-w-2xl overflow-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 flex items-center justify-between border-b border-[#ff9d00]/25 bg-[#010205]/95 px-4 py-3 backdrop-blur-md">
                    <h2 className="text-xl font-bold text-[#ffe066]">Calendar Overview</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-[#ff9d00]/40 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-[#ff9d00]/10"
                    >
                        Close
                    </button>
                </div>
                <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            onClick={handlePrevMonth}
                            className="rounded-lg border border-[#ff9d00]/40 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-[#ff9d00]/10"
                        >
                            ← Prev
                        </button>
                        <span className="text-lg font-semibold text-white">{monthName}</span>
                        <button
                            onClick={handleNextMonth}
                            className="rounded-lg border border-[#ff9d00]/40 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-[#ff9d00]/10"
                        >
                            Next →
                        </button>
                    </div>
                    <div className="mb-3 flex justify-center">
                        <Link
                            href="/habit/weekly-plan"
                            onClick={onClose}
                            className="rounded-lg border-2 border-[#ff9d00]/45 bg-[#ff9d00]/10 px-4 py-2 text-sm font-semibold text-[#ffe066] transition-colors hover:bg-[#ff9d00]/20"
                        >
                            Weekly Plan
                        </Link>
                    </div>
                    {!loading && (
                        <div
                            className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-[#ff9d00]/20 bg-[#060a14]/60 px-3 py-2 text-sm"
                            role="status"
                            aria-label={
                                monthOverall
                                    ? `Monthly overall score ${monthOverall.percent} percent, grade ${monthOverall.grade}`
                                    : 'No daily scores yet for this month'
                            }
                        >
                            <span className="text-slate-400">Month overall</span>
                            {monthOverall ? (
                                <>
                                    <span className="font-bold tabular-nums text-[#ffcc66]">
                                        {monthOverall.percent}%
                                    </span>
                                    <span className="inline-flex items-center rounded bg-[#ff9d00]/20 px-2 py-0.5 text-xs font-semibold text-[#ffcc66]">
                                        {monthOverall.grade}
                                    </span>
                                </>
                            ) : (
                                <span className="text-slate-500">No scores this month</span>
                            )}
                        </div>
                    )}
                    {loading ? (
                        <div className="py-12 text-center text-slate-400">Loading...</div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-[#ff9d00]/30">
                            <div className="grid grid-cols-7 bg-[#060a14]/90">
                                {weekDays.map((day) => (
                                    <div
                                        key={day}
                                        className="p-2 text-center text-xs font-medium text-slate-400"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {Array.from({ length: startOffset }).map((_, i) => (
                                    <div
                                        key={`empty-${i}`}
                                        className="aspect-square border border-[#ff9d00]/15 bg-black/30"
                                    />
                                ))}
                                {calendarDays.map(({ date, score }) => {
                                    const isSelected = isSameDay(date, selectedDate);
                                    const isToday = isSameDay(date, new Date());
                                    return (
                                        <button
                                            key={formatDate(date)}
                                            type="button"
                                            onClick={() => {
                                                onSelectDate(date);
                                                onClose();
                                            }}
                                            className={`aspect-square border border-[#ff9d00]/25 p-1.5 text-left transition-colors ${
                                                isSelected
                                                    ? 'border-[#ff9d00] bg-[#ff9d00]/20 ring-1 ring-[#ff9d00]'
                                                    : 'hover:bg-[#ff9d00]/10'
                                            } ${isToday ? 'ring-2 ring-[#ffcc66] ring-inset' : ''}`}
                                        >
                                            <div className="text-xs font-medium text-white mb-0.5">
                                                {date.getDate()}
                                            </div>
                                            {score && (
                                                <div className="inline-flex items-center gap-1 rounded bg-[#ff9d00]/20 px-1 py-0.5 text-[10px] font-semibold text-[#ffcc66]">
                                                    {score.grade}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
