import { formatDate } from '@/lib/habitHelpers';
import type { QuestTrend } from '@/lib/trends/trendsCopy';
import type {
    DailyScoreRow,
    HabitEntryRow,
    HabitTemplateRow,
    HabitTrend,
    LaneFilter,
} from '@/lib/trends/trendsPageTypes';

export function getDateRange(days: number): Date[] {
    const out: Date[] = [];
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        out.push(d);
    }
    return out;
}

export function shortDayLabel(d: Date): string {
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function entryWeight(status: HabitEntryRow['status']): number {
    if (status === 'checked') return 1;
    if (status === 'half') return 0.5;
    return 0;
}

export function computeStreaks(flags: boolean[]) {
    let longest = 0;
    let current = 0;
    let run = 0;
    for (let i = 0; i < flags.length; i++) {
        run = flags[i] ? run + 1 : 0;
        longest = Math.max(longest, run);
    }
    for (let i = flags.length - 1; i >= 0; i--) {
        if (flags[i]) current++;
        else break;
    }
    return { current, longest };
}

function templateMatchesLane(t: HabitTemplateRow, lane: LaneFilter): boolean {
    if (lane === 'all') return true;
    return t.category === lane;
}

export function computeHabitTrends(
    templates: HabitTemplateRow[],
    entries: HabitEntryRow[],
    dateKeys: string[],
    lane: LaneFilter,
): HabitTrend[] {
    const byHabit = new Map<string, Map<string, HabitEntryRow['status']>>();
    for (const e of entries) {
        if (!byHabit.has(e.habit_template_id)) byHabit.set(e.habit_template_id, new Map());
        byHabit.get(e.habit_template_id)!.set(e.date, e.status);
    }

    return templates
        .filter((t) => !t.is_bad_habit && templateMatchesLane(t, lane))
        .map((t) => {
            const perDay = byHabit.get(t.id) || new Map<string, HabitEntryRow['status']>();
            const weights = dateKeys.map((k) => entryWeight(perDay.get(k) ?? 'missed'));
            const fullFlags = dateKeys.map((k) => perDay.get(k) === 'checked');
            const completedWeighted = weights.reduce((a, b) => a + b, 0);
            const totalDays = weights.length;
            const completionRate =
                totalDays > 0 ? Math.round((completedWeighted / totalDays) * 100) : 0;
            const { current, longest } = computeStreaks(fullFlags);

            const half = Math.max(3, Math.floor(weights.length / 2));
            const previous = weights.slice(0, half);
            const recent = weights.slice(weights.length - half);
            const previousRate =
                previous.length > 0
                    ? (previous.reduce((a, b) => a + b, 0) / previous.length) * 100
                    : 0;
            const recentRate =
                recent.length > 0 ? (recent.reduce((a, b) => a + b, 0) / recent.length) * 100 : 0;
            const delta = Math.round(recentRate - previousRate);

            let trend: QuestTrend = 'stable';
            if (delta >= 10) trend = 'improving';
            else if (delta <= -10) trend = 'declining';

            const last10 = fullFlags.slice(Math.max(0, fullFlags.length - 10));
            const missedLast10 = last10.length > 0 && last10.every((f) => !f);

            const positiveSignals: string[] = [];
            const negativeSignals: string[] = [];
            if (current >= 3) positiveSignals.push(`Current streak: ${current} days`);
            if (trend === 'improving') positiveSignals.push(`Improved by ${delta}% vs prior period`);
            if (completionRate >= 80) positiveSignals.push(`Strong completion: ${completionRate}%`);

            if (missedLast10) negativeSignals.push('No completions in last 10 days');
            if (trend === 'declining') negativeSignals.push(`Down ${Math.abs(delta)}% vs prior period`);
            if (current === 0 && completionRate < 40) negativeSignals.push('Low momentum this period');

            return {
                id: t.id,
                name: t.name,
                icon: t.icon,
                category: t.category,
                completionRate,
                completedDays: Math.round(completedWeighted),
                totalDays,
                currentStreak: current,
                longestStreak: longest,
                trend,
                trendDelta: delta,
                missedLast10,
                positiveSignals,
                negativeSignals,
                time_of_day: t.time_of_day,
            };
        })
        .sort((a, b) => b.completionRate - a.completionRate);
}

export function indexScoresByDate(rows: DailyScoreRow[]): Map<string, DailyScoreRow> {
    const m = new Map<string, DailyScoreRow>();
    for (const r of rows) m.set(r.date, r);
    return m;
}

export type SpineLineRow = {
    label: string;
    date: string;
    coreMeter: number | null;
    habitXp: number | null;
    priorityLane: number | null;
    questClears: number | null;
};

export function buildSpineLineData(days: Date[], scoresByDate: Map<string, DailyScoreRow>): SpineLineRow[] {
    return days.map((d) => {
        const key = formatDate(d);
        const s = scoresByDate.get(key);
        return {
            label: shortDayLabel(d),
            date: key,
            coreMeter: s ? s.score_overall : null,
            habitXp: s ? s.score_habits : null,
            priorityLane: s ? s.score_priorities : null,
            questClears: s ? s.score_todos : null,
        };
    });
}

export type RhythmLaneDayRow = {
    label: string;
    date: string;
    morning: number | null;
    afternoon: number | null;
    evening: number | null;
    physical: number | null;
    mental: number | null;
    spiritual: number | null;
};

function daySlotPct(
    dateKey: string,
    slot: 'morning' | 'afternoon' | 'evening',
    templates: HabitTemplateRow[],
    byHabit: Map<string, Map<string, HabitEntryRow['status']>>,
    lane: LaneFilter,
): number | null {
    const eligible = templates.filter(
        (t) =>
            !t.is_bad_habit &&
            templateMatchesLane(t, lane) &&
            t.time_of_day === slot,
    );
    if (eligible.length === 0) return null;
    let sum = 0;
    for (const t of eligible) {
        const st = byHabit.get(t.id)?.get(dateKey) ?? 'missed';
        sum += entryWeight(st);
    }
    return Math.round((sum / eligible.length) * 100);
}

function dayLanePct(
    dateKey: string,
    cat: 'physical' | 'mental' | 'spiritual',
    templates: HabitTemplateRow[],
    byHabit: Map<string, Map<string, HabitEntryRow['status']>>,
    lane: LaneFilter,
): number | null {
    const eligible = templates.filter(
        (t) => !t.is_bad_habit && t.category === cat && templateMatchesLane(t, lane),
    );
    if (eligible.length === 0) return null;
    let sum = 0;
    for (const t of eligible) {
        const st = byHabit.get(t.id)?.get(dateKey) ?? 'missed';
        sum += entryWeight(st);
    }
    return Math.round((sum / eligible.length) * 100);
}

export function buildRhythmLaneLineData(
    days: Date[],
    templates: HabitTemplateRow[],
    entries: HabitEntryRow[],
    lane: LaneFilter,
): RhythmLaneDayRow[] {
    const byHabit = new Map<string, Map<string, HabitEntryRow['status']>>();
    for (const e of entries) {
        if (!byHabit.has(e.habit_template_id)) byHabit.set(e.habit_template_id, new Map());
        byHabit.get(e.habit_template_id)!.set(e.date, e.status);
    }

    return days.map((d) => {
        const key = formatDate(d);
        return {
            label: shortDayLabel(d),
            date: key,
            morning: daySlotPct(key, 'morning', templates, byHabit, lane),
            afternoon: daySlotPct(key, 'afternoon', templates, byHabit, lane),
            evening: daySlotPct(key, 'evening', templates, byHabit, lane),
            physical: dayLanePct(key, 'physical', templates, byHabit, lane),
            mental: dayLanePct(key, 'mental', templates, byHabit, lane),
            spiritual: dayLanePct(key, 'spiritual', templates, byHabit, lane),
        };
    });
}

export function averageDefined(values: (number | null)[]): number | null {
    const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
    if (nums.length === 0) return null;
    return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function meanCoreBars(scores: DailyScoreRow[]): { name: string; value: number }[] {
    if (scores.length === 0) return [];
    const n = scores.length;
    const avg = (pick: (s: DailyScoreRow) => number) =>
        Math.round(scores.reduce((a, s) => a + pick(s), 0) / n);
    return [
        { name: 'Core', value: avg((s) => s.score_overall) },
        { name: 'Habits', value: avg((s) => s.score_habits) },
        { name: 'Priorities', value: avg((s) => s.score_priorities) },
        { name: 'Todos', value: avg((s) => s.score_todos) },
    ];
}

export function meanTimeBars(scores: DailyScoreRow[]): { name: string; value: number }[] {
    if (scores.length === 0) return [];
    const n = scores.length;
    const avg = (pick: (s: DailyScoreRow) => number) =>
        Math.round(scores.reduce((a, s) => a + pick(s), 0) / n);
    return [
        { name: 'Morning', value: avg((s) => s.score_morning) },
        { name: 'Afternoon', value: avg((s) => s.score_afternoon) },
        { name: 'Evening', value: avg((s) => s.score_evening) },
    ];
}

export function meanLaneBars(scores: DailyScoreRow[]): { name: string; value: number }[] {
    if (scores.length === 0) return [];
    const n = scores.length;
    const avg = (pick: (s: DailyScoreRow) => number) =>
        Math.round(scores.reduce((a, s) => a + pick(s), 0) / n);
    return [
        { name: 'Physical', value: avg((s) => s.score_physical) },
        { name: 'Mental', value: avg((s) => s.score_mental) },
        { name: 'Spiritual', value: avg((s) => s.score_spiritual) },
    ];
}

export function pulseSummary(trends: HabitTrend[]) {
    return {
        levelingUp: trends.filter((t) => t.trend === 'improving').length,
        losingXp: trends.filter((t) => t.trend === 'declining').length,
        streakPower: trends.filter((t) => t.currentStreak >= 3).length,
        inactive10: trends.filter((t) => t.missedLast10).length,
    };
}
