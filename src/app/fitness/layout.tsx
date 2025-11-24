'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

const fitnessTabs = [
    { href: '/fitness', label: 'Dashboard' },
    { href: '/fitness/workouts', label: 'Workouts' },
    { href: '/fitness/meals', label: 'Meals' },
    { href: '/fitness/metrics', label: 'Metrics' },
    { href: '/fitness/settings/integrations', label: 'Integrations' },
];

export default function FitnessLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header + tabs */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image
                                src={logo}
                                alt="LevelUp Fitness logo"
                                className="h-full w-full object-contain"
                                fill
                            />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-500 dark:text-amber-400">
                                PeakMode
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">Fitness & Nutrition Tracker</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-amber-300"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>

                {/* Tabs */}
                <nav className="mx-auto flex max-w-6xl gap-2 px-6 pb-3">
                    {fitnessTabs.map(tab => {
                        const isActive = pathname === tab.href || (tab.href !== '/fitness' && pathname?.startsWith(tab.href));

                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    isActive
                                        ? 'bg-amber-500 text-black dark:bg-amber-400 dark:text-black'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-amber-600 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-amber-300'
                                }`}
                            >
                                {tab.label}
                            </Link>
                        );
                    })}
                </nav>
            </header>

            {/* Page content */}
            <div className="mx-auto max-w-6xl pb-8 pt-4">{children}</div>
        </main>
    );
}

