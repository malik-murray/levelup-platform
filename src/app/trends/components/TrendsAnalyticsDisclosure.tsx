'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import CollapsiblePanel from '@/app/dashboard/components/CollapsiblePanel';
import { trendsLayout } from '@/lib/trends/trendsCopy';

type Props = {
    children: ReactNode;
};

export default function TrendsAnalyticsDisclosure({ children }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-2xl border border-[#ff9d00]/35 bg-black/35">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
                aria-expanded={open}
            >
                <div>
                    <h3 className="text-sm font-bold text-[#ffe066]">{trendsLayout.groupMeansHeading}</h3>
                    <p className="mt-1 text-xs text-slate-400">{trendsLayout.moreAnalyticsHint}</p>
                </div>
                <span className="shrink-0 rounded-full border border-[#ff9d00]/40 px-3 py-1.5 text-xs font-semibold text-[#ffe066]">
                    {open ? trendsLayout.moreAnalyticsToggleHide : trendsLayout.moreAnalyticsToggleShow}
                </span>
            </button>
            <CollapsiblePanel open={open} className="border-t border-white/10">
                <div className="space-y-8 px-4 pb-6 pt-4 sm:px-5">{children}</div>
            </CollapsiblePanel>
        </div>
    );
}
