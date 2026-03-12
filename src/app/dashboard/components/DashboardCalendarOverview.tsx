'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@auth/supabaseClient';
import { formatDate, getMonthRange, getDatesInMonth, isSameDay } from '@/lib/habitHelpers';

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
        supabase
            .from('habit_daily_scores')
            .select('date, grade, score_overall')
            .eq('user_id', userId)
            .gte('date', startStr)
            .lte('date', endStr)
            .then(({ data }) => {
                const map = new Map<string, DayScore>();
                data?.forEach((row: { date: string; grade: string; score_overall: number }) => {
                    map.set(row.date, { date: row.date, grade: row.grade, score_overall: row.score_overall });
                });
                setScoresByDate(map);
            })
            .finally(() => setLoading(false));
    }, [userId, currentMonth]);

    const calendarDays = getDatesInMonth(currentMonth).map((date) => ({
        date,
        score: scoresByDate.get(formatDate(date)) ?? null,
    }));

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Calendar Overview</h2>
                    <button
                        onClick={onClose}
                        className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                    >
                        Close
                    </button>
                </div>
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handlePrevMonth}
                            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                        >
                            ← Prev
                        </button>
                        <span className="text-lg font-semibold text-white">{monthName}</span>
                        <button
                            onClick={handleNextMonth}
                            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                        >
                            Next →
                        </button>
                    </div>
                    {loading ? (
                        <div className="py-12 text-center text-slate-400">Loading...</div>
                    ) : (
                        <div className="rounded-lg border border-slate-700 overflow-hidden">
                            <div className="grid grid-cols-7 bg-slate-800/50">
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
                                        className="aspect-square border border-slate-700/50 bg-slate-900/50"
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
                                            className={`aspect-square border border-slate-700/50 p-1.5 text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-amber-500/30 border-amber-500 ring-1 ring-amber-500'
                                                    : 'hover:bg-slate-800'
                                            } ${isToday ? 'ring-2 ring-amber-400 ring-inset' : ''}`}
                                        >
                                            <div className="text-xs font-medium text-white mb-0.5">
                                                {date.getDate()}
                                            </div>
                                            {score && (
                                                <div className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400">
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
