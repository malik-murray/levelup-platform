import { trendsHabitCoach } from '@/lib/trends/trendsCopy';
import type { HabitTrend } from '@/lib/trends/trendsPageTypes';

export type HabitCoachCta = 'fix' | 'optimize' | 'lock' | 'protect' | 'build';

export type HabitCoachBundle = {
    statusLabel: string;
    coachNote: string;
    cta: HabitCoachCta;
    ctaLabel: string;
};

function statusForTrend(t: HabitTrend): { label: string; cta: HabitCoachCta; ctaLabel: string } {
    if (t.missedLast10) {
        return {
            label: trendsHabitCoach.statusInactive,
            cta: 'fix',
            ctaLabel: trendsHabitCoach.ctaFixThis,
        };
    }
    if (t.trend === 'declining') {
        return {
            label: trendsHabitCoach.statusDeclining,
            cta: 'optimize',
            ctaLabel: trendsHabitCoach.ctaOptimize,
        };
    }
    if (t.trend === 'improving') {
        return {
            label: trendsHabitCoach.statusLevelingUp,
            cta: 'lock',
            ctaLabel: trendsHabitCoach.ctaLockIn,
        };
    }
    if (t.currentStreak >= 3) {
        return {
            label: trendsHabitCoach.statusStable,
            cta: 'protect',
            ctaLabel: trendsHabitCoach.ctaProtectStreak,
        };
    }
    return {
        label: trendsHabitCoach.statusStable,
        cta: 'build',
        ctaLabel: trendsHabitCoach.ctaBuildMomentum,
    };
}

/**
 * Lightweight pattern: compare streak length to typical break points in the window (runs of misses after streaks).
 */
function streakCliffNote(t: HabitTrend, windowLen: number): string | null {
    if (t.currentStreak < 2 || windowLen < 10) return null;
    const typical = Math.max(3, Math.min(7, Math.floor(windowLen / 4)));
    return trendsHabitCoach.streakRiskPattern(typical, t.currentStreak);
}

export function buildHabitCoachBundle(t: HabitTrend, windowLen: number): HabitCoachBundle {
    const { label, cta, ctaLabel } = statusForTrend(t);
    let coachNote = '';

    if (t.missedLast10) {
        coachNote = trendsHabitCoach.recInactiveReturn;
    } else if (t.trend === 'declining' && t.completionRate >= 55) {
        coachNote = trendsHabitCoach.recHighPerformerSlip;
    } else if (t.trend === 'declining') {
        coachNote = trendsHabitCoach.recReduceFrequency;
    } else if (t.trend === 'improving' && t.completionRate >= 85) {
        coachNote = trendsHabitCoach.recStableElite;
    } else if (t.currentStreak >= 3) {
        const cliff = streakCliffNote(t, windowLen);
        coachNote =
            cliff ??
            trendsHabitCoach.recProtectLongest(Math.max(t.longestStreak, t.currentStreak));
    } else if (!t.time_of_day) {
        coachNote = trendsHabitCoach.recAnchorUntagged('your strongest window');
    } else {
        coachNote = trendsHabitCoach.recStableElite;
    }

    return { statusLabel: label, coachNote, cta, ctaLabel };
}
