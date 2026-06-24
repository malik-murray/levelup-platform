'use client';

import Link from 'next/link';

const settingsLinks = [
    {
        href: '/fitness/settings/profile',
        title: 'Training profile',
        description: 'Goals, level, equipment, schedule, injuries, and AI coach preferences.',
    },
    {
        href: '/fitness/settings/integrations',
        title: 'Integrations',
        description: 'Connect Apple Health, Fitbit, MyFitnessPal, and other apps.',
    },
    {
        href: '/settings',
        title: 'Account & app preferences',
        description: 'Theme, notifications, password, and global LevelUp settings.',
        external: true,
    },
];

export default function FitnessSettingsPage() {
    return (
        <div className="max-w-2xl space-y-4">
            {settingsLinks.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-amber-400/60 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/40 dark:hover:bg-slate-900/80"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                                {item.title}
                            </h2>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                {item.description}
                            </p>
                        </div>
                        <span className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden>
                            →
                        </span>
                    </div>
                </Link>
            ))}

            <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-950/20">
                <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400">Today&apos;s workout</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Your training profile powers daily workout recommendations — goals, equipment access,
                    injuries, and session length all feed into the generator and AI plan.
                </p>
            </div>
        </div>
    );
}
