'use client';

import TrendsBreakdownTable from '@/app/trends/components/TrendsBreakdownTable';
import { neon } from '@/app/dashboard/neonTheme';
import { formatDate } from '@/lib/habitHelpers';
import type { TrendsPageReadyModel, TrendsPeriodPreset } from '@/app/trends/useTrendsPageData';

type Props = {
    model: TrendsPageReadyModel;
};

const PRESETS: { id: TrendsPeriodPreset; label: string }[] = [
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'custom', label: 'Custom' },
];

export default function TrendsBreakdownPageContent({ model }: Props) {
    const {
        preset,
        setPreset,
        customStart,
        setCustomStart,
        customEnd,
        setCustomEnd,
        rangeSummary,
        rangeInvalid,
        rangeTooLong,
        habitBreakdownRows,
    } = model;

    return (
        <main className="min-w-0 space-y-6 px-4 py-8 pb-12 lg:px-8">
            <div className={`${neon.widget} mx-auto max-w-2xl space-y-6 p-4 sm:p-5`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-center text-xs text-slate-400 sm:text-left">{rangeSummary}</p>
                    <div className={`${neon.trendsPillRow} justify-center sm:justify-end`} role="group" aria-label="Time range">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPreset(p.id)}
                                className={preset === p.id ? neon.trendsPillOn : neon.trendsPillOff}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {preset === 'custom' && (
                    <div className="flex flex-wrap items-end justify-center gap-3 sm:justify-start">
                        <label className="flex flex-col gap-1 text-xs text-slate-400">
                            Start
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded-xl border border-[#ff9d00]/40 bg-[#060a14]/90 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#ff9d00]/50"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-400">
                            End
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                max={formatDate(new Date())}
                                className="rounded-xl border border-[#ff9d00]/40 bg-[#060a14]/90 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#ff9d00]/50"
                            />
                        </label>
                    </div>
                )}

                {(rangeInvalid || rangeTooLong) && preset === 'custom' && (
                    <p className="text-center text-xs text-amber-300/95">
                        {rangeTooLong
                            ? 'Use at most 365 days. Showing the last 7 days until you shorten the range.'
                            : 'Choose a valid range. Data below uses the last 7 days until fixed.'}
                    </p>
                )}
            </div>

            <div className="mx-auto max-w-2xl">
                <TrendsBreakdownTable rows={habitBreakdownRows} />
            </div>
        </main>
    );
}
