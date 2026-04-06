'use client';

import { neon } from '@/app/dashboard/neonTheme';
import TrendsScoreRing from '@/app/trends/components/TrendsScoreRing';
import type { TrendsScoreStat, TrendsScoreRow } from '@/app/trends/useTrendsPageData';

type Props = {
    rows: TrendsScoreRow[];
    activeDayPart?: 'morning' | 'afternoon' | 'evening';
};

function RowView({
    row,
    activeDayPart,
}: {
    row: TrendsScoreRow;
    activeDayPart?: 'morning' | 'afternoon' | 'evening';
}) {
    const isActiveLabel = (label: string) =>
        (label === 'Morning' && activeDayPart === 'morning') ||
        (label === 'Afternoon' && activeDayPart === 'afternoon') ||
        (label === 'Evening' && activeDayPart === 'evening');

    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <TrendsScoreRing
                label={row.left.label}
                percent={row.left.percent}
                sublabel={row.left.sublabel}
                empty={row.left.empty}
                emptyHint={row.left.emptyHint}
                activeSlot={isActiveLabel(row.left.label)}
            />
            <p className="max-w-[100px] text-center text-xs font-bold uppercase tracking-wide text-[#ff9d00]/85 sm:max-w-[140px] sm:text-sm">
                {row.centerLabel}
            </p>
            <TrendsScoreRing
                label={row.right.label}
                percent={row.right.percent}
                sublabel={row.right.sublabel}
                empty={row.right.empty}
                emptyHint={row.right.emptyHint}
                activeSlot={isActiveLabel(row.right.label)}
            />
        </div>
    );
}

export default function TrendsAnalysisDashboard({ rows, activeDayPart }: Props) {
    return (
        <div className={`${neon.panel} mx-auto mt-8 w-full max-w-lg space-y-8 p-5 sm:mt-10 sm:p-6`}>
            {rows.map((row) => (
                <RowView key={row.centerLabel} row={row} activeDayPart={activeDayPart} />
            ))}
        </div>
    );
}
