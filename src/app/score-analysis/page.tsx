'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import logo from '../logo.png';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';
import AppSidebar from '@/app/dashboard/components/AppSidebar';

type DailyScoreRow = {
    date: string;
    score_overall: number;
    grade: string;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
    score_physical: number;
    score_mental: number;
    score_spiritual: number;
    score_morning: number;
    score_afternoon: number;
    score_evening: number;
};

const SCORE_KEYS = [
    { key: 'score_overall' as const, label: 'Overall Score', color: 'text-amber-400' },
    { key: 'score_priorities' as const, label: 'Priority Score', color: 'text-purple-400' },
    { key: 'score_habits' as const, label: 'Habit Score', color: 'text-blue-400' },
    { key: 'score_todos' as const, label: 'To-Do List Score', color: 'text-emerald-400' },
    { key: 'score_mental' as const, label: 'Mental Score', color: 'text-purple-300' },
    { key: 'score_physical' as const, label: 'Physical Score', color: 'text-blue-300' },
    { key: 'score_spiritual' as const, label: 'Spiritual Score', color: 'text-amber-300' },
    { key: 'score_morning' as const, label: 'Morning Score', color: 'text-amber-200' },
    { key: 'score_afternoon' as const, label: 'Afternoon Score', color: 'text-amber-200' },
    { key: 'score_evening' as const, label: 'Evening Score', color: 'text-amber-200' },
] as const;

function avg(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function trend(current: number, previous: number): 'up' | 'down' | 'flat' {
    if (previous === 0) return 'flat';
    const diff = current - previous;
    if (diff > 0) return 'up';
    if (diff < 0) return 'down';
    return 'flat';
}

export default function ScoreAnalysisPage() {
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [scores, setScores] = useState<DailyScoreRow[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const run = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            setUserId(user.id);
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 90);
            const startStr = formatDate(start);
            const endStr = formatDate(end);
            const { data } = await supabase
                .from('habit_daily_scores')
                .select('date, score_overall, grade, score_habits, score_priorities, score_todos, score_physical, score_mental, score_spiritual, score_morning, score_afternoon, score_evening')
                .eq('user_id', user.id)
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false });
            setScores((data as DailyScoreRow[]) || []);
            setLoading(false);
        };
        run();
    }, []);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-black text-white">
                <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent mx-auto" />
                    <p className="text-sm text-slate-400">Loading...</p>
                </div>
            </main>
        );
    }

    const last7 = scores.slice(0, 7);
    const prev7 = scores.slice(7, 14);
    const last30 = scores.slice(0, 30);
    const prev30 = scores.slice(30, 60);

    return (
        <div className="min-h-screen min-w-0 bg-black text-white flex overflow-x-hidden">
            <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                <header className="border-b border-slate-800 bg-slate-950 px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 rounded-md border border-slate-700 hover:bg-slate-800"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard" className="relative h-8 w-8 sm:h-10 sm:w-10 block">
                                <Image src={logo} alt="Logo" fill className="object-contain" />
                            </Link>
                            <h1 className="text-xl sm:text-2xl font-bold">Score Analysis</h1>
                        </div>
                    </div>
                </header>
                <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-4xl mx-auto space-y-8">
                        <p className="text-slate-400">
                            Averages and trends based on your daily scores. Weekly = last 7 days. Monthly = last 30 days.
                        </p>
                        {scores.length === 0 ? (
                            <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-slate-400">
                                No score data yet. Complete daily plans on the dashboard to build your history.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {SCORE_KEYS.map(({ key, label, color }) => {
                                    const dailyVals = last7.map((r) => r[key]);
                                    const prevDailyVals = prev7.map((r) => r[key]);
                                    const weeklyAvg = avg(dailyVals);
                                    const prevWeeklyAvg = avg(prevDailyVals);
                                    const monthlyVals = last30.map((r) => r[key]);
                                    const prevMonthlyVals = prev30.map((r) => r[key]);
                                    const monthlyAvg = avg(monthlyVals);
                                    const prevMonthlyAvg = avg(prevMonthlyVals);
                                    const weeklyDir = trend(weeklyAvg, prevWeeklyAvg);
                                    const monthlyDir = trend(monthlyAvg, prevMonthlyAvg);
                                    return (
                                        <div
                                            key={key}
                                            className="rounded-lg border border-slate-700 bg-slate-900 p-4 sm:p-6"
                                        >
                                            <h2 className={`text-lg font-semibold mb-4 ${color}`}>{label}</h2>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                <div>
                                                    <div className="text-xs text-slate-400 uppercase tracking-wide">Daily (7d avg)</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xl font-bold ${color}`}>{weeklyAvg}%</span>
                                                        {weeklyDir === 'up' && <span className="text-green-400 text-sm">↑</span>}
                                                        {weeklyDir === 'down' && <span className="text-red-400 text-sm">↓</span>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-400 uppercase tracking-wide">Weekly trend</div>
                                                    <div className="text-slate-300 text-sm">
                                                        {prevWeeklyAvg > 0 ? `${weeklyDir === 'up' ? '+' : ''}${weeklyAvg - prevWeeklyAvg}% vs prev 7d` : '—'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-400 uppercase tracking-wide">Monthly (30d avg)</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xl font-bold ${color}`}>{monthlyAvg}%</span>
                                                        {monthlyDir === 'up' && <span className="text-green-400 text-sm">↑</span>}
                                                        {monthlyDir === 'down' && <span className="text-red-400 text-sm">↓</span>}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-400 uppercase tracking-wide">Monthly trend</div>
                                                    <div className="text-slate-300 text-sm">
                                                        {prevMonthlyAvg > 0 ? `${monthlyDir === 'up' ? '+' : ''}${monthlyAvg - prevMonthlyAvg}% vs prev 30d` : '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="pt-4">
                            <Link
                                href="/dashboard"
                                className="text-amber-400 hover:text-amber-300 text-sm"
                            >
                                ← Back to Dashboard
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
