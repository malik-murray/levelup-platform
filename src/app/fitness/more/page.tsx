'use client';

import Link from 'next/link';

const MORE_LINKS = [
    {
        href: '/fitness/workout-generator',
        title: 'Generate a workout',
        description: 'Build an ad-hoc workout by muscle group, equipment, and difficulty.',
    },
    {
        href: '/fitness/exercises',
        title: 'Exercise library',
        description: 'Browse exercises with filters for muscle, equipment, and difficulty.',
    },
    {
        href: '/fitness/exercises/saved',
        title: 'Saved exercises',
        description: 'Exercises you have favorited for quick access.',
    },
    {
        href: '/fitness/body-map',
        title: 'Body map',
        description: 'Explore exercises visually by muscle group.',
    },
    {
        href: '/fitness/workouts',
        title: 'Quick log',
        description: 'Manually log a strength, cardio, or stretch workout.',
    },
    {
        href: '/fitness/settings',
        title: 'Settings',
        description: 'Training profile, goals, equipment, and integrations.',
    },
];

export default function FitnessMorePage() {
    return (
        <div className="max-w-2xl space-y-4">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">More</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Everything else — exercise library, quick logging, and settings.
                </p>
            </div>

            {MORE_LINKS.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-amber-400/60 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/40 dark:hover:bg-slate-900/80"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h2>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.description}</p>
                        </div>
                        <span className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden>
                            →
                        </span>
                    </div>
                </Link>
            ))}
        </div>
    );
}
