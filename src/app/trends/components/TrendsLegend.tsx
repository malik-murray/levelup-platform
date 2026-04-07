'use client';

import { TRENDS_MAX_CUSTOM_DAYS } from '@/lib/trends/trendsRangeResolve';

export default function TrendsLegend() {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-left text-xs leading-relaxed text-zinc-400">
            <p className="font-semibold text-zinc-300">How to read this</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5">
                <li>
                    <span className="text-zinc-300">Overall, Habit, To do, Priority</span> — averages from your daily
                    scores. The fraction is scored days vs days in the range.
                </li>
                <li>
                    <span className="text-zinc-300">Morning through Spiritual</span> — check-ins (1 = done, ½ = half,
                    0 = missed) vs possible habit-days. Tag habits with a time of day or category so they count.
                </li>
                <li>
                    <span className="text-zinc-300">Vs prior period</span> — compares the same length of days ending
                    just before this range.
                </li>
                <li>Custom ranges are limited to {TRENDS_MAX_CUSTOM_DAYS} days.</li>
            </ul>
        </div>
    );
}
