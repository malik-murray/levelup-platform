'use client';

import React from 'react';
import AppAccessGate from '@/components/access/AppAccessGate';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { neon } from '@/app/dashboard/neonTheme';

const fitnessTabs = [
    { href: '/fitness', label: 'Dashboard' },
    { href: '/fitness/progress', label: 'Progress' },
    { href: '/fitness/plans', label: 'Plans' },
    { href: '/fitness/sessions', label: 'Sessions' },
    { href: '/fitness/calories', label: 'Calories' },
    { href: '/fitness/macros', label: 'Macros' },
    { href: '/fitness/exercises', label: 'Exercises' },
    { href: '/fitness/exercises/saved', label: 'Saved' },
    { href: '/fitness/workouts', label: 'Quick Log' },
    { href: '/fitness/meals', label: 'Meals' },
    { href: '/fitness/metrics', label: 'Metrics' },
    { href: '/fitness/settings', label: 'Settings' },
];

export default function FitnessLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isFitnessHome = pathname === '/fitness' || pathname === '/preview/fitness';

    if (isFitnessHome) {
        return (
            <AppAccessGate app="fitness">
            <main className="min-h-screen min-w-0 max-w-full bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">{children}</main>
            </AppAccessGate>
        );
    }

    return (
        <AppAccessGate app="fitness">
            <AppShell
                title="Fitness"
                subtitle="Fitness & nutrition tracker"
                subnav={
                    <div className={`${neon.pillRow} flex-nowrap`}>
                        {fitnessTabs.map((tab) => {
                            const isActive =
                                pathname === tab.href ||
                                (tab.href !== '/fitness' && pathname?.startsWith(tab.href)) ||
                                (tab.href === '/fitness/settings' && pathname?.startsWith('/fitness/settings'));

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



