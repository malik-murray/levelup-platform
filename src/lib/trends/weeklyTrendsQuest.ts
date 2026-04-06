import { trendsWeeklyQuest } from '@/lib/trends/trendsCopy';
import type { HabitTrend } from '@/lib/trends/trendsPageTypes';

export type WeeklyQuestPick = {
    title: string;
    subtitle: string;
    reason: string;
    reward: string;
    progressLabel: string;
    targetHabitId: string | null;
    ctaLabel: string;
};

function clearsLast7(t: HabitTrend, windowDays: number): number {
    const span = Math.min(7, t.totalDays);
    if (span <= 0) return 0;
    return Math.round((t.completionRate / 100) * span);
}

export function pickWeeklyQuest(input: {
    trends: HabitTrend[];
    rangeDays: number;
    laneAvgs: { physical: number; mental: number; spiritual: number };
    timeAvgs: { morning: number; afternoon: number; evening: number };
}): WeeklyQuestPick {
    const { trends, rangeDays, laneAvgs, timeAvgs } = input;
    const sortedLanes = Object.entries(laneAvgs).sort((a, b) => b[1] - a[1]);
    const [leadLane, weakLaneEntry] = [sortedLanes[0], sortedLanes[sortedLanes.length - 1]];
    const gap =
        leadLane && weakLaneEntry ? Math.round(leadLane[1] - weakLaneEntry[1]) : 0;

    const inactive = trends.find((t) => t.missedLast10);
    if (inactive) {
        const cur = clearsLast7(inactive, rangeDays);
        return {
            title: trendsWeeklyQuest.titleReengage(inactive.name),
            subtitle: trendsWeeklyQuest.subReengage(cur),
            reason: trendsWeeklyQuest.reasonReengage(inactive.name),
            reward: trendsWeeklyQuest.rewardLevelBoost,
            progressLabel: trendsWeeklyQuest.progressClearsWeek(cur, 5),
            targetHabitId: inactive.id,
            ctaLabel: trendsWeeklyQuest.ctaViewHabit,
        };
    }

    const hot = trends.filter((t) => t.currentStreak >= 5).sort((a, b) => b.currentStreak - a.currentStreak)[0];
    if (hot) {
        return {
            title: trendsWeeklyQuest.titleProtectStreak(hot.name),
            subtitle: trendsWeeklyQuest.subProtectStreak,
            reason: trendsWeeklyQuest.reasonProtectStreak(hot.name, hot.currentStreak),
            reward: trendsWeeklyQuest.rewardStreakXp,
            progressLabel: trendsWeeklyQuest.progressWeekClears(hot.currentStreak, hot.currentStreak + 7),
            targetHabitId: hot.id,
            ctaLabel: trendsWeeklyQuest.ctaFocusThis,
        };
    }

    const declining = trends
        .filter((t) => t.trend === 'declining')
        .sort((a, b) => a.completionRate - b.completionRate)[0];
    if (declining) {
        const drop = Math.abs(declining.trendDelta);
        const soft = drop < 15;
        return {
            title: trendsWeeklyQuest.titleRecover(declining.name),
            subtitle: soft ? trendsWeeklyQuest.subRecoverSoft : trendsWeeklyQuest.subRecover,
            reason: soft
                ? trendsWeeklyQuest.reasonRecoverSoft(declining.name)
                : trendsWeeklyQuest.reasonRecover(declining.name, drop),
            reward: trendsWeeklyQuest.rewardMomentumBoost,
            progressLabel: trendsWeeklyQuest.progressClearsWeek(clearsLast7(declining, rangeDays), soft ? 4 : 5),
            targetHabitId: declining.id,
            ctaLabel: trendsWeeklyQuest.ctaFocusThis,
        };
    }

    if (gap >= 12 && weakLaneEntry && leadLane) {
        const laneName = weakLaneEntry[0];
        return {
            title: trendsWeeklyQuest.titleLaneFocus(laneName),
            subtitle: trendsWeeklyQuest.subLaneFocus(laneName),
            reason: trendsWeeklyQuest.reasonLaneGap(leadLane[0], laneName, gap),
            reward: trendsWeeklyQuest.rewardLaneXp,
            progressLabel: trendsWeeklyQuest.progressAvgToTarget(
                weakLaneEntry[1],
                Math.min(90, weakLaneEntry[1] + 12),
            ),
            targetHabitId: null,
            ctaLabel: trendsWeeklyQuest.ctaStartQuest,
        };
    }

    const wv = Object.entries(timeAvgs).sort((a, b) => b[1] - a[1]);
    const [strong, weakT] = [wv[0], wv[wv.length - 1]];
    if (strong && weakT && strong[1] - weakT[1] >= 15) {
        const slot =
            strong[0] === 'morning'
                ? 'Morning'
                : strong[0] === 'afternoon'
                  ? 'Afternoon'
                  : 'Evening';
        const weakSlot =
            weakT[0] === 'morning'
                ? 'morning'
                : weakT[0] === 'afternoon'
                  ? 'afternoon'
                  : 'evening';
        return {
            title: trendsWeeklyQuest.titleRhythm(slot),
            subtitle: trendsWeeklyQuest.subRhythm(weakSlot),
            reason: trendsWeeklyQuest.reasonRhythm(slot, weakSlot, Math.round(strong[1] - weakT[1])),
            reward: trendsWeeklyQuest.rewardRhythmSync,
            progressLabel: trendsWeeklyQuest.progressWeekClears(0, 5),
            targetHabitId: null,
            ctaLabel: trendsWeeklyQuest.ctaStartQuest,
        };
    }

    const floorLane = sortedLanes.find(([, v]) => v > 0 && v < 80);
    if (floorLane) {
        const [name, avg] = floorLane;
        return {
            title: trendsWeeklyQuest.titleLaneFloor(name),
            subtitle: trendsWeeklyQuest.subLaneFloor,
            reason: trendsWeeklyQuest.reasonLaneFloor(name, avg),
            reward: trendsWeeklyQuest.rewardHabitXpBurst,
            progressLabel: trendsWeeklyQuest.progressAvgToTarget(avg, 80),
            targetHabitId: null,
            ctaLabel: trendsWeeklyQuest.ctaFocusThis,
        };
    }

    if (trends.length === 0) {
        return {
            title: trendsWeeklyQuest.fallbackTitle,
            subtitle: trendsWeeklyQuest.fallbackSubtitle(rangeDays),
            reason: trendsWeeklyQuest.fallbackReason,
            reward: trendsWeeklyQuest.rewardFirstWin,
            progressLabel: trendsWeeklyQuest.progressWeekClears(0, 1),
            targetHabitId: null,
            ctaLabel: trendsWeeklyQuest.ctaStartQuest,
        };
    }

    const top = trends[0];
    return {
        title: trendsWeeklyQuest.defaultTitle,
        subtitle: trendsWeeklyQuest.defaultSubtitle,
        reason: trendsWeeklyQuest.defaultReason,
        reward: trendsWeeklyQuest.rewardSteadyXp,
        progressLabel: trendsWeeklyQuest.progressClearsWeek(clearsLast7(top, rangeDays), 5),
        targetHabitId: top.id,
        ctaLabel: trendsWeeklyQuest.ctaFocusThis,
    };
}
