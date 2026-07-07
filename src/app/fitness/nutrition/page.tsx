'use client';

import Link from 'next/link';

const NUTRITION_LINKS = [
    {
        href: '/fitness/meals',
        title: 'Log food',
        description: 'Track meals, calories, and macros for the day.',
    },
    {
        href: '/fitness/metrics',
        title: 'Body metrics',
        description: 'Weight, steps, water, and sleep — daily and 14-day trend.',
    },
    {
        href: '/fitness/calories',
        title: 'Calorie target',
        description: 'Estimate your daily calorie target (TDEE) from your stats.',
    },
    {
        href: '/fitness/macros',
        title: 'Macro split',
        description: 'Break a calorie target down into protein, carbs, and fat.',
    },
];

export default function FitnessNutritionPage() {
    return (
        <div className="max-w-2xl space-y-4">
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Nutrition &amp; Tracking</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Everything related to food and body metrics, in one place.
                </p>
            </div>

            {NUTRITION_LINKS.map((item) => (
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
