'use client';

import React from 'react';
import AppAccessGate from '@/components/access/AppAccessGate';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { neon } from '@/app/dashboard/neonTheme';

const financeTabs = [
    { href: '/finance', label: 'Home' },
    { href: '/finance/accounts', label: 'Accounts' },
    { href: '/finance/transactions', label: 'Transactions' },
    { href: '/finance/budget', label: 'Budget' },
    { href: '/finance/reports', label: 'Reports' },
    { href: '/finance/chat', label: 'Ask' },
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
        <AppAccessGate app="finance">
            <AppShell
                title="Finance"
                subtitle="Accounts, transactions & budget — Plaid-ready"
                subnav={
                    <div className={`${neon.pillRow} flex-nowrap`}>
                        {financeTabs.map((tab) => {
                            const isActive =
                                pathname === tab.href ||
                                (tab.href === '/finance/settings/integrations' &&
                                    pathname?.startsWith('/finance/settings')) ||
                                (tab.href === '/finance/concierge' &&
                                    pathname?.startsWith('/finance/concierge')) ||
                                (tab.href === '/finance/chat' &&
                                    pathname?.startsWith('/finance/chat'));

                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={`flex-shrink-0 whitespace-nowrap ${isActive ? neon.pillOn : neon.pillOff}`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                }
            >
                {children}
            </AppShell>
        </AppAccessGate>
    );
}
