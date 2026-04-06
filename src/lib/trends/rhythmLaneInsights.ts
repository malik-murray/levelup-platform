import { trendsRhythmLaneInsights } from '@/lib/trends/trendsCopy';
import type { HabitTrend } from '@/lib/trends/trendsPageTypes';

export type RhythmLaneNarrative = {
    body: string;
    chips: { label: string }[];
};

function bestWorst(bars: { name: string; value: number }[]): {
    best: { name: string; value: number };
    worst: { name: string; value: number };
} | null {
    if (bars.length < 2) return null;
    const sorted = [...bars].sort((a, b) => b.value - a.value);
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function buildRhythmLaneNarrative(
    timeBars: { name: string; value: number }[],
    laneBars: { name: string; value: number }[],
    featuredHabit: HabitTrend | null,
): RhythmLaneNarrative {
    const chips: { label: string }[] = [];
    let body: string = trendsRhythmLaneInsights.neutralWeak;

    const tw = bestWorst(timeBars);
    if (tw && tw.best.value > 0) {
        const gap = tw.best.value - tw.worst.value;
        const pct =
            tw.worst.value > 0
                ? Math.round(((tw.best.value - tw.worst.value) / tw.worst.value) * 100)
                : gap;
        if (gap >= 18) {
            if (featuredHabit && !featuredHabit.time_of_day) {
                body = trendsRhythmLaneInsights.rhythmStrongNamed(
                    tw.best.name,
                    tw.worst.name,
                    pct,
                    featuredHabit.name,
                    tw.best.name,
                );
            } else {
                body = trendsRhythmLaneInsights.rhythmStrong(tw.best.name, tw.worst.name, pct);
            }
            chips.push({ label: trendsRhythmLaneInsights.chipMoveToBlock(tw.best.name) });
        } else if (gap >= 8) {
            body = trendsRhythmLaneInsights.rhythmModerate(tw.best.name, tw.worst.name, gap);
        } else {
            body = trendsRhythmLaneInsights.rhythmBalanced;
        }
    }

    const lw = bestWorst(laneBars);
    if (lw && lw.best.value > 0) {
        const gap = lw.best.value - lw.worst.value;
        const threeAvg =
            laneBars.reduce((a, b) => a + b.value, 0) / Math.max(1, laneBars.length);
        const drag = Math.round(threeAvg - lw.worst.value);
        if (gap >= 20) {
            if (body === trendsRhythmLaneInsights.neutralWeak) {
                body = trendsRhythmLaneInsights.laneStrongestWeakest(
                    lw.best.name,
                    lw.worst.name,
                    gap,
                );
            } else {
                body = `${body} ${trendsRhythmLaneInsights.laneStrongestWeakestDrags(
                    lw.best.name,
                    lw.worst.name,
                    drag,
                )}`;
            }
            chips.push({ label: trendsRhythmLaneInsights.chipFocusLane(lw.worst.name) });
        } else if (gap >= 10) {
            if (body === trendsRhythmLaneInsights.neutralWeak) {
                body = trendsRhythmLaneInsights.laneModerateTilt(
                    lw.best.name,
                    lw.worst.name,
                    gap,
                );
            }
        } else if (laneBars.length === 3) {
            const hi = Math.max(...laneBars.map((b) => b.value));
            const lo = Math.min(...laneBars.map((b) => b.value));
            const balance = Math.round(100 - hi + lo);
            if (body === trendsRhythmLaneInsights.neutralWeak) {
                body = trendsRhythmLaneInsights.laneBalanced(Math.min(99, Math.max(0, balance)));
            }
        }
    }

    if (laneBars.length === 1) {
        body = trendsRhythmLaneInsights.laneSingleSnapshot(laneBars[0].name, laneBars[0].value);
        chips.push({ label: trendsRhythmLaneInsights.chipViewAllLanes });
    }

    return { body: body.trim(), chips };
}
