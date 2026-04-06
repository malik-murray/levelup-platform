'use client';

import type { TrendInsight } from '@/lib/trendsInsights';
import { trendsCoachPanel } from '@/lib/trends/trendsCopy';

type Props = {
    rangeDays: number;
    insights: TrendInsight[];
    sufficient: boolean;
    /** When true, skip outer title block (e.g. nested inside another section) */
    embedded?: boolean;
};

const toneBorder: Record<TrendInsight['tone'], string> = {
    positive: 'border-emerald-500/25 bg-emerald-950/15',
    warn: 'border-amber-500/25 bg-amber-950/15',
    neutral: 'border-white/10 bg-black/30',
};

export default function TrendsInsightsPanel({ rangeDays, insights, sufficient, embedded }: Props) {
    return (
        <div className="space-y-3">
            {!embedded && (
                <div>
                    <h3 className="text-sm font-bold text-[#ffe066]">{trendsCoachPanel.title}</h3>
                    <p className="mt-1 text-xs text-slate-400">{trendsCoachPanel.subtitle(rangeDays)}</p>
                </div>
            )}

            {!sufficient && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm">
                    <p className="font-semibold text-amber-200">{trendsCoachPanel.fallbackTitle}</p>
                    <p className="mt-2 text-amber-100/80">{trendsCoachPanel.fallbackBody}</p>
                </div>
            )}

            <ul className="space-y-2">
                {insights.map((ins) => (
                    <li
                        key={ins.id}
                        className={`rounded-xl border p-3 ${toneBorder[ins.tone]}`}
                    >
                        <p className="text-sm font-semibold text-white">{ins.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">{ins.body}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}
