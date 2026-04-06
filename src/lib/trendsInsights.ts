import { trendInsightsCopy } from '@/lib/trends/trendsCopy';
import type { DailyScoreRow } from '@/lib/trends/trendsPageTypes';
import type { HabitTrend } from '@/lib/trends/trendsPageTypes';
import type { LaneFilter } from '@/lib/trends/trendsPageTypes';

export type TrendInsight = {
    id: string;
    title: string;
    body: string;
    tone: 'positive' | 'warn' | 'neutral';
};

export function trendsSufficientData(input: {
    daysInWindow: number;
    scoredDays: number;
    habitsInView: number;
}): boolean {
    const { daysInWindow, scoredDays, habitsInView } = input;
    if (daysInWindow < 5) return false;
    if (scoredDays < 3) return false;
    if (habitsInView < 1) return false;
    return true;
}

export function generateTrendsInsights(input: {
    rangeDays: number;
    laneFilter: LaneFilter;
    scoresChrono: DailyScoreRow[];
    habitTrends: HabitTrend[];
    avgHabitScore: number | null;
    avgPriorityScore: number | null;
}): TrendInsight[] {
    const { rangeDays, laneFilter, scoresChrono, habitTrends, avgHabitScore, avgPriorityScore } =
        input;
    const out: TrendInsight[] = [];
    let id = 0;
    const push = (title: string, body: string, tone: TrendInsight['tone']) => {
        out.push({ id: `t-${id++}`, title, body, tone });
    };

    if (scoresChrono.length >= 3) {
        const last = scoresChrono[scoresChrono.length - 1];
        const lanes = [
            { k: 'physical' as const, v: last.score_physical },
            { k: 'mental' as const, v: last.score_mental },
            { k: 'spiritual' as const, v: last.score_spiritual },
        ];
        const sorted = [...lanes].sort((a, b) => b.v - a.v);
        const hi = sorted[0];
        const lo = sorted[sorted.length - 1];
        if (hi && lo && hi.v - lo.v >= 15) {
            push(
                trendInsightsCopy.categoryStrongestTitle(trendInsightsCopy.categoryLane(hi.k)),
                trendInsightsCopy.categoryStrongestBody(trendInsightsCopy.categoryLane(hi.k)),
                'positive',
            );
            push(
                trendInsightsCopy.categoryWeakestTitle(trendInsightsCopy.categoryLane(lo.k)),
                trendInsightsCopy.categoryWeakestBody(trendInsightsCopy.categoryLane(lo.k)),
                'warn',
            );
        } else {
            push(trendInsightsCopy.categoriesTightTitle, trendInsightsCopy.categoriesTightBody, 'neutral');
        }

        const times = [
            { k: 'morning' as const, v: last.score_morning },
            { k: 'afternoon' as const, v: last.score_afternoon },
            { k: 'evening' as const, v: last.score_evening },
        ];
        const ts = [...times].sort((a, b) => b.v - a.v);
        const tHi = ts[0];
        const tLo = ts[ts.length - 1];
        if (tHi && tLo && tHi.v - tLo.v >= 12) {
            push(
                trendInsightsCopy.powerWindowTitle(trendInsightsCopy.timeLabel(tHi.k)),
                trendInsightsCopy.powerWindowBody(trendInsightsCopy.timeLabel(tHi.k)),
                'positive',
            );
        } else {
            push(trendInsightsCopy.timeEvenTitle, trendInsightsCopy.timeEvenBody, 'neutral');
        }
    }

    const improving = habitTrends.filter((t) => t.trend === 'improving');
    const declining = habitTrends.filter((t) => t.trend === 'declining');
    if (improving[0]) {
        push(
            trendInsightsCopy.habitLevelingTitle(improving[0].name),
            trendInsightsCopy.habitLevelingBody(improving[0].trendDelta),
            'positive',
        );
    }
    if (declining[0]) {
        push(
            trendInsightsCopy.habitLosingTitle(declining[0].name),
            trendInsightsCopy.habitLosingBody(declining[0].trendDelta),
            'warn',
        );
    }

    if (avgPriorityScore != null && avgHabitScore != null) {
        if (avgPriorityScore - avgHabitScore >= 8) {
            push(
                trendInsightsCopy.prioritiesAheadTitle,
                trendInsightsCopy.prioritiesAheadBody,
                'neutral',
            );
        } else if (avgHabitScore - avgPriorityScore >= 8) {
            push(trendInsightsCopy.habitsAheadTitle, trendInsightsCopy.habitsAheadBody, 'neutral');
        }
    }

    const streaky = habitTrends.filter((t) => t.currentStreak >= 5).sort((a, b) => b.currentStreak - a.currentStreak)[0];
    if (streaky) {
        push(
            trendInsightsCopy.streakTitle(streaky.name, streaky.currentStreak),
            trendInsightsCopy.streakBody,
            'positive',
        );
    }

    const longest = habitTrends.reduce(
        (best, t) => (t.longestStreak > (best?.longestStreak ?? 0) ? t : best),
        null as HabitTrend | null,
    );
    if (longest && longest.longestStreak >= 7 && longest.currentStreak < longest.longestStreak) {
        push(
            trendInsightsCopy.longerBeforeTitle,
            trendInsightsCopy.longerBeforeBody(longest.longestStreak, longest.name),
            'neutral',
        );
    }

    if (habitTrends.length > 0) {
        const avgClear = Math.round(
            habitTrends.reduce((a, t) => a + t.completionRate, 0) / habitTrends.length,
        );
        push(
            trendInsightsCopy.solidHitTitle,
            trendInsightsCopy.solidHitBody(avgClear),
            avgClear >= 70 ? 'positive' : 'neutral',
        );
    }

    if (scoresChrono.length >= 8) {
        const mid = Math.floor(scoresChrono.length / 2);
        const early = scoresChrono.slice(0, mid);
        const late = scoresChrono.slice(mid);
        const e = early.reduce((a, s) => a + s.score_overall, 0) / early.length;
        const l = late.reduce((a, s) => a + s.score_overall, 0) / late.length;
        if (l + 5 < e) push(trendInsightsCopy.backHalfSoftTitle, trendInsightsCopy.backHalfSoftBody, 'warn');
        else if (l > e + 5) push(trendInsightsCopy.closingStrongTitle, trendInsightsCopy.closingStrongBody, 'positive');
    }

    const avgMom =
        scoresChrono.length > 0
            ? Math.round(
                  scoresChrono.reduce((a, s) => a + s.score_overall, 0) / scoresChrono.length,
              )
            : null;
    if (avgMom != null) {
        push(
            trendInsightsCopy.paddingMomentumTitle(avgMom),
            avgMom >= 65
                ? trendInsightsCopy.paddingMomentumBodyHigh
                : trendInsightsCopy.paddingMomentumBodyLow,
            'neutral',
        );
    }

    push(
        trendInsightsCopy.paddingActiveDaysTitle(scoresChrono.length),
        trendInsightsCopy.paddingActiveDaysBody,
        'neutral',
    );

    push(
        trendInsightsCopy.paddingScopeTitle(habitTrends.length),
        laneFilter === 'all'
            ? trendInsightsCopy.paddingScopeBodyAll
            : trendInsightsCopy.paddingScopeBodyFiltered(laneFilter),
        'neutral',
    );

    return out.slice(0, 12);
}
