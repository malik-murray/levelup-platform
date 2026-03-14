'use client';

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@auth/supabaseClient";
import logo from "../logo.png";
import { formatDate } from "@/lib/habitHelpers";
import HabitDailyEntrySection from "./components/HabitDailyEntrySection";
import NewsfeedSection from "./components/NewsfeedSection";
import DashboardNotesSection from "./components/DashboardNotesSection";
import FitnessWidget from "./components/FitnessWidget";
import MarketsWidget from "./components/MarketsWidget";
import FinanceWidget from "./components/FinanceWidget";
import AppSidebar from "./components/AppSidebar";
import DashboardScoreBars, { type DashboardScores } from "./components/DashboardScoreBars";
import DashboardCalendarOverview from "./components/DashboardCalendarOverview";

type Timeframe = 'daily' | 'weekly' | 'custom';

export default function DashboardPage() {
    const router = useRouter();
    const [email, setEmail] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timeframe, setTimeframe] = useState<Timeframe>('daily');
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [headerScores, setHeaderScores] = useState<DashboardScores | null>(null);
    const [showCalendarOverview, setShowCalendarOverview] = useState(false);
    const [dailyScoreOpen, setDailyScoreOpen] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                
                if (error || !user) {
                    console.error('Authentication error:', error);
                    window.location.href = "/login";
                    return;
                }

                setUserId(user.id);
                setEmail(user.email ?? null);
                
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    console.error('No active session found');
                    window.location.href = "/login";
                    return;
                }

                console.log('✅ User authenticated:', { userId: user.id, email: user.email });
            } catch (err) {
                console.error('Error checking authentication:', err);
                window.location.href = "/login";
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    useEffect(() => {
        setHeaderScores(null);
    }, [selectedDate, timeframe]);

    const handlePrevDay = () => {
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 1);
        setSelectedDate(prev);
        setTimeframe('daily');
    };

    const handleToday = () => {
        setSelectedDate(new Date());
        setTimeframe('daily');
    };

    const handleNextDay = () => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 1);
        setSelectedDate(next);
        setTimeframe('daily');
    };

    const handleSetupNextDay = () => {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = formatDate(nextDay);
        router.push(`/habit?tab=daily&date=${nextDayStr}`);
    };


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

    return (
        <div className="min-h-screen min-w-0 bg-black text-white flex overflow-x-hidden">
            {/* Sidebar */}
            <AppSidebar 
                isOpen={sidebarOpen} 
                onClose={() => setSidebarOpen(false)} 
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                {/* Header */}
                <header className="relative border-b border-slate-800 bg-slate-950 min-w-0">
                    <div className="px-4 sm:px-6 lg:px-8 py-4 min-w-0">
                        <div className="flex items-center justify-between gap-2 sm:gap-4 flex-nowrap min-w-0">
                            <div className="flex items-center gap-4 min-w-0 overflow-hidden">
                                <button
                                    onClick={() => setSidebarOpen(!sidebarOpen)}
                                    className="lg:hidden p-2 rounded-md border border-slate-700 hover:bg-slate-800"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="relative h-8 w-8 sm:h-10 sm:w-10">
                                        <Image
                                            src={logo}
                                            alt="LevelUpSolutions logo"
                                            className="h-full w-full object-contain"
                                            fill
                                            priority
                                        />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <h1 className="text-xl sm:text-2xl font-bold truncate">Dashboard</h1>
                                        <span className="text-sm text-slate-400 truncate" title={selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}>
                                            {selectedDate.toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {email && (
                                    <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1.5">
                                        <span className="text-xs text-slate-400">Logged in as</span>
                                        <span className="text-xs font-medium text-white truncate max-w-[150px]">
                                            {email}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Date Controls - prev day, Today, Overview, next day */}
                        <div className="mt-4 flex justify-between items-center gap-2">
                            <button
                                onClick={handlePrevDay}
                                className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
                                aria-label="Previous day"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button
                                onClick={handleToday}
                                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCalendarOverview(true)}
                                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
                            >
                                Calendar overview
                            </button>
                            <button
                                onClick={handleNextDay}
                                className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
                                aria-label="Next day"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        {/* Daily Score - collapsible, full width, daily only */}
                        {timeframe === 'daily' && (
                            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 min-w-0 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setDailyScoreOpen((o) => !o)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-bold text-white">Daily Score</h2>
                                        {headerScores?.grade && (
                                            <span className="text-lg font-semibold text-amber-400">({headerScores.grade})</span>
                                        )}
                                    </div>
                                    <svg className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${dailyScoreOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {dailyScoreOpen && (
                                    <DashboardScoreBars scores={headerScores} />
                                )}
                            </div>
                        )}
                    </div>
                </header>

                {/* Calendar overview overlay */}
                {showCalendarOverview && (
                    <DashboardCalendarOverview
                        userId={userId}
                        selectedDate={selectedDate}
                        onSelectDate={(date) => {
                            setSelectedDate(date);
                            setTimeframe('daily');
                        }}
                        onClose={() => setShowCalendarOverview(false)}
                    />
                )}

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto min-w-0">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full min-w-0">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Main Section - Habit Tracker (Center, Largest) */}
                            <div className="lg:col-span-7 xl:col-span-8 min-w-0">
                                <HabitDailyEntrySection 
                                    selectedDate={selectedDate}
                                    timeframe={timeframe}
                                    customStartDate={customStartDate}
                                    customEndDate={customEndDate}
                                    userId={userId}
                                    onScoresChange={setHeaderScores}
                                />
                            </div>

                            {/* Secondary Section - Notes & Newsfeed */}
                            <div className="lg:col-span-5 xl:col-span-4">
                                <div className="space-y-6">
                                    {timeframe === 'daily' && (
                                        <DashboardNotesSection 
                                            selectedDate={selectedDate}
                                            userId={userId}
                                        />
                                    )}
                                    <NewsfeedSection 
                                        selectedDate={selectedDate}
                                        timeframe={timeframe}
                                        userId={userId}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar Widgets */}
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FitnessWidget 
                                selectedDate={selectedDate}
                                userId={userId}
                            />
                            <MarketsWidget userId={userId} />
                            <FinanceWidget 
                                selectedDate={selectedDate}
                                userId={userId}
                            />
                        </div>

                        {/* Set up next day - bottom of page */}
                        <div className="mt-8 flex justify-center pb-6">
                            <button
                                onClick={handleSetupNextDay}
                                className="rounded-md border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-950/30 transition-colors whitespace-nowrap"
                            >
                                Set up next day
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
