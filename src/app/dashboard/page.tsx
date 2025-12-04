'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@auth/supabaseClient";
import logo from "../logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

type App = {
    name: string;
    href: string;
    description: string;
    status: "open" | "coming";
    icon?: string;
};

function AppCard({ app }: { app: App }) {
    const isOpen = app.status === "open";
    
    const cardContent = (
        <div
            className={`
                group relative rounded-xl sm:rounded-2xl border bg-slate-950 p-4 sm:p-6
                transition-all duration-300 ease-out
                ${isOpen 
                    ? 'border-amber-500/30 hover:border-amber-500/60 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 cursor-pointer active:scale-[0.98]' 
                    : 'border-slate-800 hover:border-slate-700 cursor-not-allowed opacity-75'
                }
            `}
        >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:via-amber-500/0 group-hover:to-amber-500/0 transition-all duration-300 pointer-events-none" />
            
            <div className="relative z-10">
                {/* App Icon/Initials */}
                <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
                    <span className="text-lg sm:text-xl font-bold text-amber-400">
                        {app.icon || app.name.charAt(0)}
                    </span>
                </div>

                {/* App Name */}
                <h3 className="mb-1.5 sm:mb-2 text-base sm:text-lg font-semibold text-white">
                    {app.name}
                </h3>

                {/* Description */}
                <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {app.description}
                </p>

                {/* Status Badge */}
                {isOpen ? (
                    <span className="inline-flex items-center rounded-full bg-amber-400 px-3 py-1.5 sm:px-4 text-xs font-semibold text-black shadow-lg shadow-amber-500/25">
                        Open
                    </span>
                ) : (
                    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 sm:px-4 text-xs font-medium text-slate-400">
                        Coming soon
                    </span>
                )}
            </div>
        </div>
    );

    if (isOpen) {
        return (
            <Link href={app.href} className="block">
                {cardContent}
            </Link>
        );
    }

    return cardContent;
}

export default function DashboardPage() {
    const [email, setEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (!data.user) {
                window.location.href = "/login";
            } else {
                setEmail(data.user.email ?? null);
            }
            setLoading(false);
        });
    }, []);

    const apps: App[] = [
        {
            name: "Habit Tracker",
            href: "/habit",
            description: "Track daily habits, XP, streaks, and life scores.",
            status: "open",
            icon: "📈",
        },
        {
            name: "Finance Tracker",
            href: "/finance",
            description: "Visualize your cashflow, savings, and long-term goals.",
            status: "open",
            icon: "💰",
        },
        {
            name: "Fitness Tracker",
            href: "/fitness",
            description: "Track workouts, meals, and metrics. PeakMode.",
            status: "open",
            icon: "💪",
        },
        {
            name: "Resume Generator",
            href: "/resume",
            description: "Upload your resume + job description → Get tailored resume & cover letter.",
            status: "open",
            icon: "📄",
        },
        {
            name: "Emotional Tracker",
            href: "/emotions",
            description: "Log emotions, triggers, and coping strategies.",
            status: "open",
            icon: "💭",
        },
        {
            name: "Stock & Crypto Analyzer",
            href: "/markets",
            description: "Monitor portfolios, track watchlists, and analyze moves.",
            status: "open",
            icon: "📊",
        },
        {
            name: "Newsfeed Summarizer",
            href: "/newsfeed",
            description: "Turn information overload into short daily briefs.",
            status: "open",
            icon: "📰",
        },
        {
            name: "Reflection to Lesson",
            href: "/reflection",
            description: "Convert journal entries into lessons and action steps.",
            status: "open",
            icon: "✨",
        },
    ];

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
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Hero Section */}
            <header className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-black via-slate-950 to-black transition-colors">
                {/* Outerspace Background */}
                <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
                
                {/* Stars Layer 1 - Large Stars */}
                <div className="absolute inset-0 opacity-60">
                    <div className="absolute top-[20%] left-[15%] w-1 h-1 bg-amber-400 rounded-full animate-pulse" />
                    <div className="absolute top-[35%] left-[45%] w-1.5 h-1.5 bg-amber-300 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-[50%] left-[70%] w-1 h-1 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                    <div className="absolute top-[65%] left-[25%] w-1 h-1 bg-amber-300 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute top-[80%] left-[60%] w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
                </div>
                
                {/* Stars Layer 2 - Small Stars */}
                <div className="absolute inset-0 opacity-40">
                    <div className="absolute top-[10%] left-[30%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[15%] left-[60%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[25%] left-[80%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[30%] left-[10%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[40%] left-[55%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[45%] left-[85%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[55%] left-[20%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[60%] left-[50%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[70%] left-[75%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[75%] left-[40%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[85%] left-[15%] w-0.5 h-0.5 bg-white rounded-full" />
                    <div className="absolute top-[90%] left-[65%] w-0.5 h-0.5 bg-white rounded-full" />
                </div>
                
                {/* Nebula 1 - Amber/Gold */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(245,158,11,0.4),transparent_60%)] pointer-events-none" />
                </div>
                
                {/* Nebula 2 - Amber/Gold */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,rgba(245,196,81,0.35),transparent_65%)] pointer-events-none" />
                </div>
                
                {/* Additional Stars - Scattered */}
                <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: `radial-gradient(2px 2px at 20% 30%, white, transparent),
                                     radial-gradient(2px 2px at 60% 70%, white, transparent),
                                     radial-gradient(1px 1px at 50% 50%, white, transparent),
                                     radial-gradient(1px 1px at 80% 10%, white, transparent),
                                     radial-gradient(2px 2px at 90% 60%, white, transparent),
                                     radial-gradient(1px 1px at 30% 80%, white, transparent),
                                     radial-gradient(2px 2px at 70% 40%, white, transparent),
                                     radial-gradient(1px 1px at 10% 50%, white, transparent),
                                     radial-gradient(1px 1px at 40% 20%, white, transparent),
                                     radial-gradient(2px 2px at 85% 90%, white, transparent)`,
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                }} />
                
                {/* Subtle cosmic glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-950/5 to-transparent pointer-events-none" />
                
                <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16 z-10">
                    <div className="flex flex-col items-start justify-between gap-4 sm:gap-6 sm:flex-row sm:items-center">
                        {/* Brand Section */}
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                            <div className="relative h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 flex-shrink-0">
                                <Image
                                    src={logo}
                                    alt="LevelUpSolutions logo"
                                    className="h-full w-full object-contain"
                                    fill
                                    priority
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl font-bold text-white dark:text-white sm:text-2xl lg:text-3xl xl:text-4xl drop-shadow-lg truncate">
                                    LevelUpSolutions
                                </h1>
                                <p className="mt-1 text-xs text-slate-200 dark:text-slate-300 sm:text-sm lg:text-base drop-shadow-md line-clamp-2">
                                    Your personal operating system for habits, money, mindset, and more.
                                </p>
                            </div>
                        </div>

                        {/* User Actions */}
                        {email && (
                            <div className="flex flex-col w-full sm:w-auto items-stretch sm:items-end gap-2 sm:gap-3 sm:flex-row sm:items-center">
                                <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white/50 px-3 py-2 sm:px-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
                                    <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-400">Logged in as</span>
                                    <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                                        {email}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ThemeToggle />
                                    <button
                                        onClick={async () => {
                                            await supabase.auth.signOut();
                                            window.location.href = "/login";
                                        }}
                                        className="rounded-full border border-slate-300 bg-white/50 px-4 py-2 text-xs font-medium text-slate-700 backdrop-blur-sm transition-all hover:border-amber-500/50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-amber-300 flex-shrink-0"
                                    >
                                        Log out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* App Grid Section */}
            <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
                <div className="mb-6 text-center sm:mb-8 lg:mb-12">
                    <h2 className="text-xl font-bold text-white sm:text-2xl lg:text-3xl">
                        Your Apps
                    </h2>
                    <p className="mt-2 text-xs text-slate-400 sm:text-sm lg:text-base">
                        Choose an app to get started. We'll build each one out step by step.
                    </p>
                </div>

                {/* App Grid */}
                <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {apps.map((app) => (
                        <AppCard key={app.name} app={app} />
                    ))}
                </div>
            </section>

            {/* Footer spacing */}
            <div className="h-16" />
        </main>
    );
}
