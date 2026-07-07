'use client';

import Link from 'next/link';
import type { AppKey } from '@/lib/access/types';
import { LOCKED_APP_LABELS } from '@/lib/access/entitlements';

type LockedAppPreviewProps = {
    app: Exclude<AppKey, 'dashboard' | 'habit' | 'settings'>;
    description?: string;
    compact?: boolean;
};

const DEFAULT_DESCRIPTIONS: Record<LockedAppPreviewProps['app'], string> = {
    'habit-weekly-plan': 'Plan your week with focus items, events, and score targets.',
    finance: 'Track accounts, transactions, budgets, and spending insights.',
    fitness: 'Log workouts, meals, body metrics, and training programs.',
    newsfeed: 'Personalized news digest with summaries and saved articles.',
    trends: 'Analytics on habits, scores, streaks, and weekly patterns.',
    todo: 'Daily to-dos synced with your master task backlog.',
    goals: 'Long-term goals, vision board, and milestone tracking.',
    markets: 'Stock and crypto analysis with alerts and signals.',
};

export default function LockedAppPreview({ app, description, compact }: LockedAppPreviewProps) {
    const title = LOCKED_APP_LABELS[app];
    const blurb = description ?? DEFAULT_DESCRIPTIONS[app];

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border-2 border-[#ff9d00]/25 bg-black/35 ${
                compact ? 'p-4' : 'p-5'
            }`}
        >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#ff9d00]/[0.06] via-transparent to-[#6366f1]/[0.05]" />
            <div className="relative">
                <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg" aria-hidden>
                        🔒
                    </span>
                    <h3 className={`font-bold text-[#ffe066] ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
                    <span className="rounded-full border border-[#ff9d00]/35 bg-[#ff9d00]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffb86b]">
                        Premium
                    </span>
                </div>
                <p className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>{blurb}</p>
                <p className={`mt-2 text-slate-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                    Preview only — subscribe to unlock full access.
                </p>
                <div className={`flex flex-wrap gap-2 ${compact ? 'mt-3' : 'mt-4'}`}>
                    <Link
                        href="/login?mode=signup"
                        className="inline-flex items-center rounded-lg border border-[#ff9d00]/50 bg-[#ff9d00]/15 px-3 py-1.5 text-xs font-semibold text-[#ffe066] transition hover:bg-[#ff9d00]/25"
                    >
                        Sign up for access
                    </Link>
                    <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-lg border border-slate-600/50 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold text-slate-500"
                    >
                        Subscribe (soon)
                    </button>
                </div>
            </div>
        </div>
    );
}
