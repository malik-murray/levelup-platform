'use client';

import { trendsAverageZone } from '@/lib/trends/trendsCopy';

type Bar = { name: string; value: number };

type Props = {
    core: Bar[];
    time: Bar[];
    lane: Bar[];
    hasScoreRows: boolean;
};

function BarRow({ name, value }: Bar) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
                <span>{name}</span>
                <span className="tabular-nums text-slate-200">{value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ff9d00] to-[#ffea8a]"
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
            </div>
        </div>
    );
}

export default function TrendsMeansSection({ core, time, lane, hasScoreRows }: Props) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                <h4 className="text-sm font-bold text-[#ffe066]">{trendsAverageZone.barCoreTitle}</h4>
                <p className="mt-1 text-[10px] text-slate-500">{trendsAverageZone.barCoreEmpty}</p>
                <div className="mt-3 space-y-3">
                    {!hasScoreRows ? (
                        <p className="text-xs text-slate-500">{trendsAverageZone.barCoreEmpty}</p>
                    ) : core.length === 0 ? (
                        <p className="text-xs text-slate-500">{trendsAverageZone.barCoreNoBars}</p>
                    ) : (
                        core.map((b) => <BarRow key={b.name} name={b.name} value={b.value} />)
                    )}
                </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                <h4 className="text-sm font-bold text-[#ffe066]">{trendsAverageZone.barTimeTitle}</h4>
                <p className="mt-1 text-[10px] text-slate-500">{trendsAverageZone.barTimeHint}</p>
                <div className="mt-3 space-y-3">
                    {!hasScoreRows ? (
                        <p className="text-xs text-slate-500">{trendsAverageZone.barTimeEmpty}</p>
                    ) : time.every((t) => t.value === 0) ? (
                        <p className="text-xs text-slate-500">{trendsAverageZone.barTimeEmptyRange}</p>
                    ) : (
                        time.map((b) => <BarRow key={b.name} name={b.name} value={b.value} />)
                    )}
                </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                <h4 className="text-sm font-bold text-[#ffe066]">{trendsAverageZone.barLaneTitle}</h4>
                <p className="mt-1 text-[10px] text-slate-500">{trendsAverageZone.barLaneHint}</p>
                <div className="mt-3 space-y-3">
                    {!hasScoreRows ? (
                        <p className="text-xs text-slate-500">{trendsAverageZone.barLaneEmpty}</p>
                    ) : lane.every((l) => l.value === 0) ? (
                        <p className="text-xs text-slate-500">{trendsAverageZone.barLaneEmpty}</p>
                    ) : (
                        lane.map((b) => <BarRow key={b.name} name={b.name} value={b.value} />)
                    )}
                </div>
            </div>
        </div>
    );
}
