'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

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
        <main
            className="min-h-screen min-w-0 max-w-full text-slate-200 transition-colors"
            style={{ backgroundColor: '#0a0e14' }}
        >
            <header
                className="border-b transition-colors"
                style={{ borderColor: '#1e293b', backgroundColor: '#0f1419' }}
            >
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 sm:gap-3 transition-opacity hover:opacity-80"
                    >
                        <div className="relative h-8 w-8 flex-shrink-0">
                            <Image
                                src={logo}
                                alt="LevelUp Financial logo"
                                className="h-full w-full object-contain"
                                fill
                            />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-violet-300 sm:text-xl">LevelUp Financial</h1>
                            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                                Dark dashboard · Plaid-ready
                            </p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-violet-950/50"
                            style={{ borderColor: '#1e293b', backgroundColor: '#0a0e14' }}
                        >
                            <span className="hidden sm:inline">← Dashboard</span>
                            <span className="sm:hidden">←</span>
                        </Link>
                    </div>
                </div>

                <nav className="mx-auto max-w-7xl overflow-x-auto px-4 pb-3 sm:px-6 scrollbar-hide">
                    <div className="flex min-w-max gap-2 sm:min-w-0">
                        {financeTabs.map(tab => {
                            const isActive =
                                pathname === tab.href ||
                                (tab.href === '/finance/settings/integrations' &&
                                    pathname?.startsWith('/finance/settings')) ||
                                (tab.href === '/finance/concierge' &&
                                    pathname?.startsWith('/finance/concierge'));

                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                                        isActive
                                            ? 'border border-violet-500/80 bg-violet-600/25 text-violet-100 shadow-[0_0_20px_rgba(124,58,237,0.25)]'
                                            : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                                    }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            </header>

            <div className="mx-auto max-w-7xl px-2 pb-10 pt-2 sm:px-4">{children}</div>
        </main>
    );
}
