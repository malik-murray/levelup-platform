'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const settingsTabs = [
    { href: '/fitness/settings', label: 'Overview', exact: true },
    { href: '/fitness/settings/profile', label: 'Training profile' },
    { href: '/fitness/settings/integrations', label: 'Integrations' },
];

export default function FitnessSettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Manage your training profile, AI coach preferences, and integrations.
                </p>
            </div>

            <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {settingsTabs.map((tab) => {
                    const isActive = tab.exact
                        ? pathname === tab.href
                        : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);

                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                                isActive
                                    ? 'bg-amber-500 text-black dark:bg-amber-400'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-amber-600 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-amber-300'
                            }`}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>

            {children}
        </div>
    );
}
