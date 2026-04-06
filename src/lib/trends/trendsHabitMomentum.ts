import { formatDate } from '@/lib/habitHelpers';
import { computeStreaks, entryWeight } from '@/lib/trends/trendsPageHelpers';
import type { HabitEntryRow, HabitTemplateRow } from '@/lib/trends/trendsPageTypes';
import { enumerateDateKeysInclusive, todayLocal } from '@/lib/trends/trendsRangeResolve';

export type HabitMomentumRow = {
    id: string;
    name: string;
    icon: string;
    category: string;
    timeLabel: string;
    /** Consecutive days at end of range with half or full completion */
    currentGoodStreak: number;
    longestGoodStreak: number;
    /** Consecutive missed days at end of range */
    currentMissStreak: number;
    longestMissStreak: number;
};

function timeLabel(t: HabitTemplateRow): string {
    if (t.time_of_day) return t.time_of_day.charAt(0).toUpperCase() + t.time_of_day.slice(1);
    return 'Any time';
}

function computeMissStreaks(missFlags: boolean[]): { current: number; longest: number } {
    let longest = 0;
    let run = 0;
    for (let i = 0; i < missFlags.length; i += 1) {
        run = missFlags[i] ? run + 1 : 0;
        longest = Math.max(longest, run);
    }
    let current = 0;
    for (let i = missFlags.length - 1; i >= 0; i -= 1) {
        if (missFlags[i]) current += 1;
        else break;
    }
    return { current, longest };
}

export function buildHabitMomentumRows(
    templates: HabitTemplateRow[],
    entries: HabitEntryRow[],
    dateKeys: string[],
): HabitMomentumRow[] {
    const byHabit = new Map<string, Map<string, HabitEntryRow['status']>>();
    for (const e of entries) {
        if (!byHabit.has(e.habit_template_id)) byHabit.set(e.habit_template_id, new Map());
        byHabit.get(e.habit_template_id)!.set(e.date, e.status);
    }

    const active = templates.filter((t) => !t.is_bad_habit);

    return active.map((t) => {
        const perDay = byHabit.get(t.id) || new Map<string, HabitEntryRow['status']>();
        const goodFlags = dateKeys.map((k) => entryWeight(perDay.get(k) ?? 'missed') >= 0.5);
        const missFlags = dateKeys.map((k) => entryWeight(perDay.get(k) ?? 'missed') === 0);
        const { current: currentGoodStreak, longest: longestGoodStreak } = computeStreaks(goodFlags);
        const { current: currentMissStreak, longest: longestMissStreak } = computeMissStreaks(missFlags);

        return {
            id: t.id,
            name: t.name,
            icon: t.icon,
            category: t.category,
            timeLabel: timeLabel(t),
            currentGoodStreak,
            longestGoodStreak,
            currentMissStreak,
            longestMissStreak,
        };
    });
}

const EMPTY_STREAKS = {
    currentGoodStreak: 0,
    longestGoodStreak: 0,
    currentMissStreak: 0,
    longestMissStreak: 0,
} as const;

/**
 * Calendar streaks from each habit’s first logged day through today (local).
 * Days before the first log are not counted — that habit’s timeline starts at its first entry.
 */
export function buildHabitOverallMomentumRows(
    templates: HabitTemplateRow[],
    entries: HabitEntryRow[],
): HabitMomentumRow[] {
    const byHabit = new Map<string, Map<string, HabitEntryRow['status']>>();
    for (const e of entries) {
        if (!byHabit.has(e.habit_template_id)) byHabit.set(e.habit_template_id, new Map());
        byHabit.get(e.habit_template_id)!.set(e.date, e.status);
    }

    const endStr = formatDate(todayLocal());
    const active = templates.filter((t) => !t.is_bad_habit);

    return active.map((t) => {
        const perDay = byHabit.get(t.id);
        if (!perDay || perDay.size === 0) {
            return {
                id: t.id,
                name: t.name,
                icon: t.icon,
                category: t.category,
                timeLabel: timeLabel(t),
                ...EMPTY_STREAKS,
            };
        }

        const dates = [...perDay.keys()].sort();
        const startStr = dates[0]!;
        const dateKeys = enumerateDateKeysInclusive(startStr, endStr);
        if (dateKeys.length === 0) {
            return {
                id: t.id,
                name: t.name,
                icon: t.icon,
                category: t.category,
                timeLabel: timeLabel(t),
                ...EMPTY_STREAKS,
            };
        }

        const goodFlags = dateKeys.map((k) => entryWeight(perDay.get(k) ?? 'missed') >= 0.5);
        const missFlags = dateKeys.map((k) => entryWeight(perDay.get(k) ?? 'missed') === 0);
        const { current: currentGoodStreak, longest: longestGoodStreak } = computeStreaks(goodFlags);
        const { current: currentMissStreak, longest: longestMissStreak } = computeMissStreaks(missFlags);

        return {
            id: t.id,
            name: t.name,
            icon: t.icon,
            category: t.category,
            timeLabel: timeLabel(t),
            currentGoodStreak,
            longestGoodStreak,
            currentMissStreak,
            longestMissStreak,
        };
    });
}
