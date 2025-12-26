'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MoneyQuotesCarousel } from '@/components/MoneyQuotesCarousel';

const financeTabs = [
    { href: '/finance', label: 'Home' },
    { href: '/finance/accounts', label: 'Accounts' },
    { href: '/finance/transactions', label: 'Transactions' },
    { href: '/finance/budget', label: 'Budget' },
    { href: '/finance/reports', label: 'Reports' },
    { href: '/finance/concierge', label: 'Concierge' },
    { href: '/finance/settings/integrations', label: 'Settings' },
];

export default function FinanceLayout({
                                          children,
                                      }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header + tabs */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8 flex-shrink-0">
                            <Image
                                src={logo}
                                alt="LevelUp Financial logo"
                                className="h-full w-full object-contain"
                                fill
                            />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-amber-500 sm:text-xl dark:text-amber-400">
                                LevelUp Financial
                            </h1>
                            <div className="mt-0.5 hidden sm:block">
                                <MoneyQuotesCarousel />
                            </div>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-amber-300"
                        >
                            <span className="hidden sm:inline">← Dashboard</span>
                            <span className="sm:hidden">←</span>
                        </Link>
                    </div>
                </div>

                {/* Tabs - scrollable on mobile */}
                <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-3 sm:px-6 scrollbar-hide">
                    <div className="flex gap-2 min-w-max sm:min-w-0">
                        {financeTabs.map(tab => {
                            const isActive = pathname === tab.href || 
                                (tab.href === '/finance/settings/integrations' && pathname?.startsWith('/finance/settings')) ||
                                (tab.href === '/finance/concierge' && pathname?.startsWith('/finance/concierge'));

                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={`rounded-full px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                                        isActive
                                            ? 'bg-amber-500 text-black dark:bg-amber-400 dark:text-black'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-amber-600 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-amber-300'
                                    }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </header>

            {/* Page content */}
            <div className="mx-auto max-w-6xl px-4 pb-8 pt-4 sm:px-6">{children}</div>
        </main>
    );
}
