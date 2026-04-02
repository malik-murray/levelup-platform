'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';

type RangeOption = 7 | 14 | 30 | 60 | 90;

type HabitTemplate = {
    id: string;
    name: string;
    icon: string;
    category: 'physical' | 'mental' | 'spiritual';
    is_bad_habit?: boolean;
    is_active?: boolean;
};

type HabitEntry = {
    habit_template_id: string;
    date: string;
    status: 'checked' | 'missed';
};

type HabitTrend = {
    id: string;
    name: string;
    icon: string;
    category: string;
    completionRate: number;
    completedDays: number;
    totalDays: number;
    currentStreak: number;
    longestStreak: number;
    trend: 'improving' | 'declining' | 'stable';
    trendDelta: number;
    missedLast10: boolean;
    positiveSignals: string[];
    negativeSignals: string[];
};

const RANGE_OPTIONS: RangeOption[] = [7, 14, 30, 60, 90];

function getDateRange(days: number): Date[] {
    const out: Date[] = [];
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        out.push(d);
    }
    return out;
}

function computeStreaks(flags: boolean[]) {
    let longest = 0;
    let current = 0;
    let run = 0;

    for (let i = 0; i < flags.length; i++) {
        run = flags[i] ? run + 1 : 0;
        longest = Math.max(longest, run);
    }

    for (let i = flags.length - 1; i >= 0; i--) {
        if (flags[i]) current++;
        else break;
    }

    return { current, longest };
}

export default function TrendsPage() {
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [rangeDays, setRangeDays] = useState<RangeOption>(30);
    const [templates, setTemplates] = useState<HabitTemplate[]>([]);
    const [entries, setEntries] = useState<HabitEntry[]>([]);

    const days = useMemo(() => getDateRange(rangeDays), [rangeDays]);
    const startDateStr = formatDate(days[0]);
    const endDateStr = formatDate(days[days.length - 1]);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            setUserId(user.id);
        })();
    }, []);

    useEffect(() => {
        if (!userId) return;

        const load = async () => {
            setLoading(true);
            try {
                const { data: templateData } = await supabase
                    .from('habit_templates')
                    .select('id, name, icon, category, is_bad_habit, is_active')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .order('sort_order');

                const { data: entryData } = await supabase
                    .from('habit_daily_entries')
                    .select('habit_template_id, date, status')
                    .eq('user_id', userId)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr);

                setTemplates((templateData || []) as HabitTemplate[]);
                setEntries((entryData || []) as HabitEntry[]);
            } catch (err) {
                console.error('Error loading trends:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [userId, startDateStr, endDateStr]);

    const trends = useMemo<HabitTrend[]>(() => {
        const dateKeys = days.map((d) => formatDate(d));
        const checkedByHabitByDate = new Map<string, Map<string, boolean>>();

        for (const e of entries) {
            if (!checkedByHabitByDate.has(e.habit_template_id)) {
                checkedByHabitByDate.set(e.habit_template_id, new Map());
            }
            checkedByHabitByDate.get(e.habit_template_id)!.set(e.date, e.status === 'checked');
        }

        return templates
            .filter((t) => !t.is_bad_habit)
            .map((t) => {
                const perDay = checkedByHabitByDate.get(t.id) || new Map<string, boolean>();
                const flags = dateKeys.map((k) => !!perDay.get(k));
                const completedDays = flags.filter(Boolean).length;
                const totalDays = flags.length;
                const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
                const { current, longest } = computeStreaks(flags);

                const half = Math.max(3, Math.floor(flags.length / 2));
                const previous = flags.slice(0, half);
                const recent = flags.slice(flags.length - half);
                const previousRate = previous.length > 0
                    ? (previous.filter(Boolean).length / previous.length) * 100
                    : 0;
                const recentRate = recent.length > 0
                    ? (recent.filter(Boolean).length / recent.length) * 100
                    : 0;
                const delta = Math.round(recentRate - previousRate);

                let trend: HabitTrend['trend'] = 'stable';
                if (delta >= 10) trend = 'improving';
                else if (delta <= -10) trend = 'declining';

                const last10 = flags.slice(Math.max(0, flags.length - 10));
                const missedLast10 = last10.length > 0 && last10.every((f) => !f);

                const positiveSignals: string[] = [];
                const negativeSignals: string[] = [];
                if (current >= 3) positiveSignals.push(`Current streak: ${current} days`);
                if (trend === 'improving') positiveSignals.push(`Improved by ${delta}% vs prior period`);
                if (completionRate >= 80) positiveSignals.push(`Strong completion: ${completionRate}%`);

                if (missedLast10) negativeSignals.push('No completions in last 10 days');
                if (trend === 'declining') negativeSignals.push(`Down ${Math.abs(delta)}% vs prior period`);
                if (current === 0 && completionRate < 40) negativeSignals.push('Low momentum this period');

                return {
                    id: t.id,
                    name: t.name,
                    icon: t.icon,
                    category: t.category,
                    completionRate,
                    completedDays,
                    totalDays,
                    currentStreak: current,
                    longestStreak: longest,
                    trend,
                    trendDelta: delta,
                    missedLast10,
                    positiveSignals,
                    negativeSignals,
                };
            })
            .sort((a, b) => b.completionRate - a.completionRate);
    }, [templates, entries, days]);

    const summary = useMemo(() => {
        const improving = trends.filter((t) => t.trend === 'improving').length;
        const declining = trends.filter((t) => t.trend === 'declining').length;
        const strongStreaks = trends.filter((t) => t.currentStreak >= 3).length;
        const warningHabits = trends.filter((t) => t.missedLast10).length;
        return { improving, declining, strongStreaks, warningHabits };
    }, [trends]);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-slate-400">Loading trends...</div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white px-4 sm:px-6 lg:px-8 py-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Trends</h1>
                        <p className="text-sm text-slate-400">
                            Positive and negative habit trends with streak/decline detection.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href="/dashboard"
                            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-slate-400">Range:</span>
                        {RANGE_OPTIONS.map((d) => (
                            <button
                                key={d}
                                onClick={() => setRangeDays(d)}
                                className={`px-3 py-1.5 rounded text-sm border ${
                                    rangeDays === d
                                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                {d} days
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-green-500/30 bg-green-950/20 p-3">
                        <div className="text-xs text-green-300">Improving</div>
                        <div className="text-2xl font-bold text-green-400">{summary.improving}</div>
                    </div>
                    <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3">
                        <div className="text-xs text-red-300">Declining</div>
                        <div className="text-2xl font-bold text-red-400">{summary.declining}</div>
                    </div>
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
                        <div className="text-xs text-amber-300">3+ Day Streaks</div>
                        <div className="text-2xl font-bold text-amber-400">{summary.strongStreaks}</div>
                    </div>
                    <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3">
                        <div className="text-xs text-purple-300">No Completion (10d)</div>
                        <div className="text-2xl font-bold text-purple-400">{summary.warningHabits}</div>
                    </div>
                </div>

                <section className="space-y-3">
                    {trends.length === 0 ? (
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
                            No active habits found for trend analysis.
                        </div>
                    ) : (
                        trends.map((t) => (
                            <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-lg">{t.icon}</span>
                                        <span className="font-semibold truncate">{t.name}</span>
                                        <span className="text-xs text-slate-500 uppercase">{t.category}</span>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded border ${
                                            t.trend === 'improving'
                                                ? 'border-green-500/40 bg-green-500/15 text-green-300'
                                                : t.trend === 'declining'
                                                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                                                : 'border-slate-600 bg-slate-800 text-slate-300'
                                        }`}
                                    >
                                        {t.trend === 'stable'
                                            ? 'Stable'
                                            : `${t.trend === 'improving' ? '+' : ''}${t.trendDelta}% ${t.trend}`}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                                    <div>
                                        <div className="text-slate-400 text-xs">Completion</div>
                                        <div className="font-semibold">{t.completionRate}%</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 text-xs">Completed Days</div>
                                        <div className="font-semibold">{t.completedDays}/{t.totalDays}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 text-xs">Current Streak</div>
                                        <div className="font-semibold">{t.currentStreak} days</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 text-xs">Longest Streak</div>
                                        <div className="font-semibold">{t.longestStreak} days</div>
                                    </div>
                                </div>

                                <div className="h-2 rounded bg-slate-800 overflow-hidden mb-3">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
                                        style={{ width: `${t.completionRate}%` }}
                                    />
                                </div>

                                <div className="grid md:grid-cols-2 gap-3">
                                    <div className="rounded border border-green-500/20 bg-green-950/10 p-2">
                                        <div className="text-xs font-semibold text-green-300 mb-1">Positive signals</div>
                                        {t.positiveSignals.length === 0 ? (
                                            <div className="text-xs text-slate-400">No strong positive signal yet.</div>
                                        ) : (
                                            <ul className="text-xs text-green-200 space-y-1">
                                                {t.positiveSignals.map((s) => (
                                                    <li key={s}>+ {s}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="rounded border border-red-500/20 bg-red-950/10 p-2">
                                        <div className="text-xs font-semibold text-red-300 mb-1">Negative signals</div>
                                        {t.negativeSignals.length === 0 ? (
                                            <div className="text-xs text-slate-400">No negative trend detected.</div>
                                        ) : (
                                            <ul className="text-xs text-red-200 space-y-1">
                                                {t.negativeSignals.map((s) => (
                                                    <li key={s}>- {s}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </section>
            </div>
        </main>
    );
}
