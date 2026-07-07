'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoneyQuotesCarousel } from '@/components/MoneyQuotesCarousel';
import AppAccessGate from '@/components/access/AppAccessGate';
import AppShell from '@/components/shell/AppShell';
import { neon } from '@/app/dashboard/neonTheme';

const marketsTabs = [
    { href: '/markets', label: 'Dashboard' },
    { href: '/markets/portfolio', label: 'Portfolio' },
    { href: '/markets/alerts', label: 'Alerts' },
    { href: '/markets/settings', label: 'Settings' },
];

export default function MarketsLayout({
                                         children,
                                     }: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <AppAccessGate app="markets">
            <AppShell
                title="Markets"
                subtitle="Stock & crypto analyzer"
                subnav={
                    <div className="flex flex-col gap-2">
                        <div className={`${neon.pillRow} flex-nowrap`}>
                            {marketsTabs.map((tab) => {
                                const isActive =
                                    pathname === tab.href ||
                                    (tab.href === '/markets' &&
                                        pathname?.startsWith('/markets/') &&
                                        !marketsTabs.some((t) => pathname === t.href));

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
                        <MoneyQuotesCarousel />
                    </div>
                }
            >
                {children}
            </AppShell>
        </AppAccessGate>
    );
}
