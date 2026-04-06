import { trendsHud } from '@/lib/trends/trendsCopy';
import type { DailyScoreRow, HabitTrend, LaneFilter } from '@/lib/trends/trendsPageTypes';

export type PlayerHudStats = {
    hasEnoughData: boolean;
    rankDisplay: string;
    streakPowerDays: number;
    momentumLabel: string;
    bossLaneLabel: string;
    oneLiner: string;
};

function laneLabel(lane: LaneFilter): string {
    if (lane === 'all') return trendsHud.lanesAll;
    return trendsHud.laneNamed(lane);
}

export function derivePlayerHudStats(input: {
    scoresInRange: DailyScoreRow[];
    habitTrends: HabitTrend[];
    laneFilter: LaneFilter;
}): PlayerHudStats {
    const { scoresInRange, habitTrends, laneFilter } = input;
    const scoredDays = scoresInRange.length;
    const hasEnoughData = scoredDays >= 3;

    const avgOverall =
        scoredDays > 0
            ? Math.round(
                  scoresInRange.reduce((a, s) => a + s.score_overall, 0) / scoredDays,
              )
            : null;

    const rankDisplay =
        avgOverall != null ? `${Math.min(100, Math.max(0, avgOverall))}` : '—';

    const streakPowerDays = habitTrends.reduce((m, t) => Math.max(m, t.currentStreak), 0);

    let momentumLabel: string = trendsHud.momentumNeedLongerRun;
    if (scoredDays >= 4) {
        const mid = Math.floor(scoredDays / 2);
        const early = scoresInRange.slice(0, mid);
        const late = scoresInRange.slice(mid);
        const eAvg =
            early.length > 0
                ? early.reduce((a, s) => a + s.score_overall, 0) / early.length
                : 0;
        const lAvg =
            late.length > 0
                ? late.reduce((a, s) => a + s.score_overall, 0) / late.length
                : 0;
        const delta = Math.round(lAvg - eAvg);
        if (Math.abs(delta) < 5) momentumLabel = trendsHud.momentumStableZone;
        else if (delta > 0) momentumLabel = trendsHud.momentumGainingXp(delta);
        else momentumLabel = trendsHud.momentumLosingXp(Math.abs(delta));
    }

    const last = scoresInRange[scoresInRange.length - 1];
    let bossLaneLabel: string = trendsHud.weakAreaNotEnough;
    if (last) {
        const triple = [
            { k: 'physical' as const, v: last.score_physical, label: trendsHud.weakAreaPhysical },
            { k: 'mental' as const, v: last.score_mental, label: trendsHud.weakAreaMental },
            { k: 'spiritual' as const, v: last.score_spiritual, label: trendsHud.weakAreaSpiritual },
        ];
        const filtered =
            laneFilter === 'all'
                ? triple
                : triple.filter((x) => x.k === laneFilter);
        if (filtered.length === 1) {
            bossLaneLabel = `${filtered[0].label} (${laneLabel(laneFilter)})`;
        } else if (filtered.length > 0) {
            const weak = filtered.reduce((a, b) => (a.v <= b.v ? a : b));
            bossLaneLabel = weak.label;
        }
    }

    if (habitTrends.length === 0) {
        bossLaneLabel = trendsHud.weakAreaNoHabitsInLane;
    }

    let oneLiner: string = trendsHud.oneLinerNeedData;
    if (hasEnoughData && avgOverall != null) {
        if (avgOverall >= 72) {
            oneLiner = `${trendsHud.oneLinerStrong} ${laneLabel(laneFilter)}.`;
        } else {
            oneLiner = `${trendsHud.oneLinerShoreUp} ${laneLabel(laneFilter)} ${trendsHud.oneLinerShoreUpSuffix}`;
        }
    }

    return {
        hasEnoughData,
        rankDisplay,
        streakPowerDays,
        momentumLabel,
        bossLaneLabel,
        oneLiner,
    };
}
