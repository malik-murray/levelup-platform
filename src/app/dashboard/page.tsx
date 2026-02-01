'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@auth/supabaseClient";
import logo from "../logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatDate, isSameDay } from "@/lib/habitHelpers";
import HabitDailyEntrySection from "./components/HabitDailyEntrySection";
import NewsfeedSection from "./components/NewsfeedSection";
import FitnessWidget from "./components/FitnessWidget";
import MarketsWidget from "./components/MarketsWidget";
import FinanceWidget from "./components/FinanceWidget";
import AppSidebar from "./components/AppSidebar";

type Timeframe = 'daily' | 'weekly' | 'custom';

export default function DashboardPage() {
    const [email, setEmail] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timeframe, setTimeframe] = useState<Timeframe>('daily');
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

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

    const handleToday = () => {
        setSelectedDate(new Date());
        setTimeframe('daily');
    };

    const handleYesterday = () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setSelectedDate(yesterday);
        setTimeframe('daily');
    };

    const formatDisplayDate = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (isSameDay(date, today)) {
            return 'Today';
        } else if (isSameDay(date, yesterday)) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
            });
        }
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
        <div className="min-h-screen bg-black text-white flex">
            {/* Sidebar */}
            <AppSidebar 
                isOpen={sidebarOpen} 
                onClose={() => setSidebarOpen(false)} 
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="border-b border-slate-800 bg-slate-950">
                    <div className="px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between">
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
                                    <div className="relative h-8 w-8 sm:h-10 sm:w-10">
                                        <Image
                                            src={logo}
                                            alt="LevelUpSolutions logo"
                                            className="h-full w-full object-contain"
                                            fill
                                            priority
                                        />
                                    </div>
                                    <h1 className="text-xl sm:text-2xl font-bold">Daily Entry</h1>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {email && (
                                    <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1.5">
                                        <span className="text-xs text-slate-400">Logged in as</span>
                                        <span className="text-xs font-medium text-white truncate max-w-[150px]">
                                            {email}
                                        </span>
                                    </div>
                                )}
                                <ThemeToggle />
                                <button
                                    onClick={async () => {
                                        await supabase.auth.signOut();
                                        window.location.href = "/login";
                                    }}
                                    className="rounded-full border border-slate-700 bg-slate-900/50 px-4 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                                >
                                    Log out
                                </button>
                            </div>
                        </div>

                        {/* Date Controls */}
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={formatDate(selectedDate)}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setSelectedDate(new Date(e.target.value));
                                            setTimeframe('daily');
                                        }
                                    }}
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                                />
                                <button
                                    onClick={handleToday}
                                    className="rounded-md border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-950/30 transition-colors"
                                >
                                    Today
                                </button>
                                <button
                                    onClick={handleYesterday}
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                                >
                                    Yesterday
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setTimeframe('daily')}
                                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                        timeframe === 'daily'
                                            ? 'bg-amber-500 text-black'
                                            : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    Daily
                                </button>
                                <button
                                    onClick={() => setTimeframe('weekly')}
                                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                        timeframe === 'weekly'
                                            ? 'bg-amber-500 text-black'
                                            : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    Weekly
                                </button>
                                <button
                                    onClick={() => setTimeframe('custom')}
                                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                        timeframe === 'custom'
                                            ? 'bg-amber-500 text-black'
                                            : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    Custom
                                </button>
                            </div>

                            {timeframe === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={customStartDate ? formatDate(customStartDate) : ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setCustomStartDate(new Date(e.target.value));
                                            }
                                        }}
                                        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                                        placeholder="Start date"
                                    />
                                    <span className="text-slate-400">to</span>
                                    <input
                                        type="date"
                                        value={customEndDate ? formatDate(customEndDate) : ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setCustomEndDate(new Date(e.target.value));
                                            }
                                        }}
                                        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                                        placeholder="End date"
                                    />
                                </div>
                            )}

                            <div className="text-sm text-slate-400">
                                {timeframe === 'daily' && formatDisplayDate(selectedDate)}
                                {timeframe === 'weekly' && `Week of ${formatDisplayDate(selectedDate)}`}
                                {timeframe === 'custom' && customStartDate && customEndDate && 
                                    `${formatDisplayDate(customStartDate)} - ${formatDisplayDate(customEndDate)}`
                                }
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto">
                    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Main Section - Habit Tracker (Center, Largest) */}
                            <div className="lg:col-span-7 xl:col-span-8">
                                <HabitDailyEntrySection 
                                    selectedDate={selectedDate}
                                    timeframe={timeframe}
                                    customStartDate={customStartDate}
                                    customEndDate={customEndDate}
                                    userId={userId}
                                />
                            </div>

                            {/* Secondary Section - Newsfeed */}
                            <div className="lg:col-span-5 xl:col-span-4">
                                <div className="space-y-6">
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
                    </div>
                </main>
            </div>
        </div>
    );
}
