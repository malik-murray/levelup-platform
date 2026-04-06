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
import type { SpineLineRow } from '@/lib/trends/trendsPageHelpers';
import { trendsXpTrend } from '@/lib/trends/trendsCopy';
import {
    axisTick,
    chartShellClass,
    spineColors,
    trendsChartTooltipStyle,
} from '@/app/trends/trendsChartStyles';

type Props = {
    data: SpineLineRow[];
    rangeDays: number;
    hasSpineData: boolean;
    hasAnyHabits: boolean;
};

export default function TrendsPrimarySpineChart({ data, rangeDays, hasSpineData, hasAnyHabits }: Props) {
    const emptyMessage = !hasAnyHabits
        ? trendsXpTrend.emptyNoHabits
        : !hasSpineData
          ? trendsXpTrend.emptyNoScores
          : null;

    return (
        <div className={chartShellClass}>
            <h3 className="text-sm font-bold text-[#ffe066]">{trendsXpTrend.chartCoreTitle}</h3>
            <p className="mt-1 text-xs text-slate-400">{trendsXpTrend.chartCoreSubtitle}</p>
            <div className="mt-3 h-64 w-full min-w-0 sm:h-72">
                {emptyMessage ? (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/10 px-4 text-center text-sm text-slate-400">
                        {emptyMessage}
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
                            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                            <Line
                                type="monotone"
                                dataKey="coreMeter"
                                name={trendsXpTrend.seriesCoreMeter}
                                stroke={spineColors.coreMeter}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                            <Line
                                type="monotone"
                                dataKey="habitXp"
                                name={trendsXpTrend.seriesHabitXp}
                                stroke={spineColors.habitXp}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                            <Line
                                type="monotone"
                                dataKey="priorityLane"
                                name={trendsXpTrend.seriesPriorityLane}
                                stroke={spineColors.priorityLane}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                            <Line
                                type="monotone"
                                dataKey="questClears"
                                name={trendsXpTrend.seriesQuestClears}
                                stroke={spineColors.questClears}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
                {trendsXpTrend.sectionSubtitle(rangeDays)}
            </p>
        </div>
    );
}
