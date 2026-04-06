'use client';

import Link from 'next/link';
import type { WeeklyQuestPick } from '@/lib/trends/weeklyTrendsQuest';
import { trendsWeeklyQuest } from '@/lib/trends/trendsCopy';

type Props = {
    quest: WeeklyQuestPick;
};

export default function WeeklyTrendsQuestBanner({ quest }: Props) {
    const href = quest.targetHabitId ? `/habit/${quest.targetHabitId}/edit` : '/dashboard';

    return (
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/35 bg-gradient-to-r from-violet-950/50 to-black/50 p-4 shadow-[0_0_28px_rgba(139,92,246,0.15)] sm:p-5">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/90">
                {trendsWeeklyQuest.sectionEyebrow}
            </p>
            <p className="mt-1 text-xs text-slate-400">{trendsWeeklyQuest.sectionSub}</p>
            <h3 className="mt-3 text-lg font-bold text-white sm:text-xl">{quest.title}</h3>
            <p className="mt-1 text-sm text-violet-100/85">{quest.subtitle}</p>
            <p className="mt-3 text-sm text-slate-300">{quest.reason}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                    <p className="font-semibold uppercase tracking-wider text-slate-500">
                        {trendsWeeklyQuest.rewardLabel}
                    </p>
                    <p className="mt-0.5 text-slate-200">{quest.reward}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                    <p className="font-semibold uppercase tracking-wider text-slate-500">
                        {trendsWeeklyQuest.progressLabelEyebrow}
                    </p>
                    <p className="mt-0.5 font-mono text-slate-200">{quest.progressLabel}</p>
                </div>
                <Link
                    href={href}
                    className="inline-flex items-center rounded-full border border-violet-400/50 bg-violet-500/20 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/30"
                >
                    {quest.ctaLabel}
                </Link>
            </div>
        </div>
    );
}
