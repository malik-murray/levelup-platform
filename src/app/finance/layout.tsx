'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import logo from '../logo.png'; // adjust path if your logo lives elsewhere
// If you move the logo into /public, use: import logo from '/public/logo.png';

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
        <main className="min-h-screen bg-black text-white">
            {/* Header + tabs */}
            <header className="border-b border-slate-800 bg-black">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="relative h-8 w-8">
                            <Image
                                src={logo}
                                alt="LevelUp Financial logo"
                                className="h-full w-full object-contain"
                                fill
                            />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">
                                LevelUp Financial
                            </h1>
                            <p className="text-xs text-slate-400">
                                Shared money dashboard for you and your family.
                            </p>
                        </div>
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
                                        ? 'bg-amber-400 text-black'
                                        : 'text-slate-300 hover:bg-slate-900 hover:text-amber-300'
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
