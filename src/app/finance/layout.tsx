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
];

export default function FinanceLayout({
                                          children,
                                      }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <main className="min-h-screen bg-black text-white dark:bg-black dark:text-white light:bg-white light:text-slate-900 transition-colors">
            {/* Header + tabs */}
            <header className="border-b border-slate-800 bg-black dark:border-slate-800 dark:bg-black light:border-slate-200 light:bg-white transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image
                                src={logo}
                                alt="LevelUp Financial logo"
                                className="h-full w-full object-contain"
                                fill
                            />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400 dark:text-amber-400 light:text-amber-500">
                                LevelUp Financial
                            </h1>
                            <div className="mt-0.5">
                                <MoneyQuotesCarousel />
                            </div>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 light:border-slate-300 light:bg-slate-100 light:text-slate-700 light:hover:bg-slate-200"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>

                {/* Tabs */}
                <nav className="mx-auto flex max-w-6xl gap-2 px-6 pb-3">
                    {financeTabs.map(tab => {
                        const isActive = pathname === tab.href;

                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    isActive
                                        ? 'bg-amber-400 text-black dark:bg-amber-400 dark:text-black light:bg-amber-500 light:text-black'
                                        : 'text-slate-300 hover:bg-slate-900 hover:text-amber-300 dark:text-slate-300 dark:hover:bg-slate-900 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-amber-600'
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
