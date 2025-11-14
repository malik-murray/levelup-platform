'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (!data.user) {
                window.location.href = "/login";
            } else {
                setEmail(data.user.email ?? null);
            }
        });
    }, []);

    const apps = [
        {
            name: "Habit Tracker",
            href: "/habit",
            description: "Track daily habits, XP, streaks, and life scores.",
        },
        {
            name: "Finance Tracker",
            href: "/finance",
            description: "Visualize your cashflow, savings, and long-term goals.",
        },
        {
            name: "Resume Generator",
            href: "/resume",
            description: "Generate job-specific resumes and cover letters in seconds.",
        },
        {
            name: "Emotional Tracker",
            href: "/emotions",
            description: "Log emotions, triggers, and coping strategies.",
        },
        {
            name: "Stock & Crypto Analyzer",
            href: "/markets",
            description: "Monitor portfolios, track watchlists, and analyze moves.",
        },
        {
            name: "Newsfeed Summarizer",
            href: "/newsfeed",
            description: "Turn information overload into short daily briefs.",
        },
        {
            name: "Reflection to Lesson",
            href: "/reflection",
            description: "Convert journal entries into lessons and action steps.",
        },
    ];

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <div>
                    <h1 className="text-xl font-semibold">LevelUpSolutions Dashboard</h1>
                    <p className="text-xs text-slate-400">
                        Welcome to your ecosystem. This is the central hub for all your apps.
                    </p>
                </div>
                {email && (
                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400">Logged in as</span>
                        <span className="rounded-full bg-slate-900 px-3 py-1 font-medium">
              {email}
            </span>
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                window.location.href = "/login";
                            }}
                            className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
                        >
                            Log out
                        </button>
                    </div>
                )}
            </header>

            <section className="px-6 py-6 space-y-4">
                <p className="text-xs text-slate-400">
                    Choose an app to open. We’ll build each one out step by step, but all of
                    them live here.
                </p>

                <div className="grid gap-4 md:grid-cols-3">
                    {apps.map((app) => (
                        <div
                            key={app.href}
                            className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex flex-col justify-between"
                        >
                            <div>
                                <h3 className="text-sm font-semibold mb-1">{app.name}</h3>
                                <p className="text-xs text-slate-400 mb-3">{app.description}</p>
                            </div>
                            <div>
                                <Link
                                    href={app.href}
                                    className="inline-block text-xs rounded-md bg-emerald-500 px-3 py-1 font-semibold text-black hover:bg-emerald-400"
                                >
                                    Open
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
