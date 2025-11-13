'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (!data.user) {
                window.location.href = '/login';
            } else {
                setEmail(data.user.email);
            }
        });
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">LevelUpSolutions Dashboard</h1>
                <div className="flex items-center gap-4 text-sm">
                    {email && <span>{email}</span>}
                    <button
                        onClick={handleLogout}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800"
                    >
                        Log out
                    </button>
                </div>
            </header>

            <section className="px-6 py-8">
                <h2 className="mb-2 text-lg font-semibold">Welcome to your ecosystem</h2>
                <p className="mb-6 text-sm text-slate-300">
                    This is the central hub where you&apos;ll access your Habit Tracker, Finance Tracker,
                    Resume Generator, Newsfeed, and more.
                </p>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                        <h3 className="text-sm font-semibold mb-1">Habit Tracker</h3>
                        <p className="text-xs text-slate-400 mb-2">
                            Track daily habits, XP, streaks, and life scores.
                        </p>
                        <button className="text-xs rounded-md bg-emerald-500 px-3 py-1 font-semibold text-black hover:bg-emerald-400">
                            Open (soon)
                        </button>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                        <h3 className="text-sm font-semibold mb-1">Resume Generator</h3>
                        <p className="text-xs text-slate-400 mb-2">
                            Generate job-specific resumes and cover letters in seconds.
                        </p>
                        <button className="text-xs rounded-md bg-slate-800 px-3 py-1 text-slate-200">
                            Coming soon
                        </button>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                        <h3 className="text-sm font-semibold mb-1">Finance Tracker</h3>
                        <p className="text-xs text-slate-400 mb-2">
                            Visualize your cashflow, savings, and long-term goals.
                        </p>
                        <button className="text-xs rounded-md bg-slate-800 px-3 py-1 text-slate-200">
                            Coming soon
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}
