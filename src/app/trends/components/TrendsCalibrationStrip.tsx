'use client';

import { RANGE_OPTIONS, type LaneFilter, type RangeOption } from '@/lib/trends/trendsPageTypes';
import { trendsFilters } from '@/lib/trends/trendsCopy';
import { filterPillClass } from '@/app/trends/trendsChartStyles';

type Props = {
    rangeDays: RangeOption;
    onRangeDays: (d: RangeOption) => void;
    laneFilter: LaneFilter;
    onLaneFilter: (l: LaneFilter) => void;
};

const LANES: { id: LaneFilter; label: string }[] = [
    { id: 'all', label: trendsFilters.categoryAll },
    { id: 'physical', label: trendsFilters.categoryPhysical },
    { id: 'mental', label: trendsFilters.categoryMental },
    { id: 'spiritual', label: trendsFilters.categorySpiritual },
];

export default function TrendsCalibrationStrip({
    rangeDays,
    onRangeDays,
    laneFilter,
    onLaneFilter,
}: Props) {
    return (
        <div className="rounded-2xl border border-[#ff9d00]/40 bg-black/40 p-4 backdrop-blur-md">
            <h3 className="text-sm font-bold text-[#ffe066]">{trendsFilters.sectionTitle}</h3>
            <p className="mt-1 text-xs text-slate-400">{trendsFilters.sectionSubtitle}</p>
            <div className="mt-4 space-y-4">
                <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        {trendsFilters.rangeEyebrow}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {RANGE_OPTIONS.map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => onRangeDays(d)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filterPillClass(rangeDays === d)}`}
                            >
                                {d}d
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        {trendsFilters.categoryEyebrow}
                    </p>
                    <p className="mb-2 text-[10px] text-slate-500">{trendsFilters.categoryHint}</p>
                    <div className="flex flex-wrap gap-2">
                        {LANES.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onLaneFilter(id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filterPillClass(laneFilter === id)}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
