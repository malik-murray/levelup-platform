'use client';

import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { RhythmLaneDayRow } from '@/lib/trends/trendsPageHelpers';
import type { LaneFilter } from '@/lib/trends/trendsPageTypes';
import { trendsXpTrend } from '@/lib/trends/trendsCopy';
import {
    axisTick,
    chartShellClass,
    laneColors,
    rhythmColors,
    trendsChartTooltipStyle,
} from '@/app/trends/trendsChartStyles';

type Props = {
    data: RhythmLaneDayRow[];
    rangeDays: number;
    laneFilter: LaneFilter;
    hasTimeTaggedHabits: boolean;
    rhythmEmpty: boolean;
    laneEmpty: boolean;
};

export default function TrendsPatternCharts({
    data,
    rangeDays,
    laneFilter,
    hasTimeTaggedHabits,
    rhythmEmpty,
    laneEmpty,
}: Props) {
    return (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div className={chartShellClass}>
                <h3 className="text-sm font-bold text-[#ffe066]">{trendsXpTrend.chartRhythmTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">{trendsXpTrend.chartRhythmSubtitle}</p>
                <div className="mt-3 h-56 w-full min-w-0">
                    {!hasTimeTaggedHabits ? (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 px-3 text-center text-xs text-slate-400">
                            {trendsXpTrend.chartRhythmEmptyHint}
                        </div>
                    ) : rhythmEmpty ? (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 px-3 text-center text-xs text-slate-400">
                            {trendsXpTrend.chartRhythmNoData}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={axisTick}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                />
                                <Tooltip contentStyle={trendsChartTooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line
                                    type="monotone"
                                    dataKey="morning"
                                    name={trendsXpTrend.seriesMorning}
                                    stroke={rhythmColors.morning}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                                <Line
                                    type="monotone"
                                    dataKey="afternoon"
                                    name={trendsXpTrend.seriesAfternoon}
                                    stroke={rhythmColors.afternoon}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                                <Line
                                    type="monotone"
                                    dataKey="evening"
                                    name={trendsXpTrend.seriesEvening}
                                    stroke={rhythmColors.evening}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className={chartShellClass}>
                <h3 className="text-sm font-bold text-[#ffe066]">{trendsXpTrend.chartLanesTitle}</h3>
                <p className="mt-1 text-xs text-slate-400">
                    {laneFilter === 'all'
                        ? trendsXpTrend.chartLanesSubtitleAll
                        : trendsXpTrend.chartLanesSubtitleOne(
                              laneFilter.charAt(0).toUpperCase() + laneFilter.slice(1),
                          )}
                </p>
                <div className="mt-3 h-56 w-full min-w-0">
                    {laneEmpty ? (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 px-3 text-center text-xs text-slate-400">
                            {trendsXpTrend.chartLanesNoData}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={axisTick}
                                    tickLine={false}
                                    axisLine={false}
                                    width={36}
                                />
                                <Tooltip contentStyle={trendsChartTooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line
                                    type="monotone"
                                    dataKey="physical"
                                    name={trendsXpTrend.seriesPhysical}
                                    stroke={laneColors.physical}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                                <Line
                                    type="monotone"
                                    dataKey="mental"
                                    name={trendsXpTrend.seriesMental}
                                    stroke={laneColors.mental}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                                <Line
                                    type="monotone"
                                    dataKey="spiritual"
                                    name={trendsXpTrend.seriesSpiritual}
                                    stroke={laneColors.spiritual}
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            <p className="col-span-full text-[10px] text-slate-500 lg:col-span-2">
                {trendsXpTrend.sectionSubtitle(rangeDays)}
            </p>
        </div>
    );
}
