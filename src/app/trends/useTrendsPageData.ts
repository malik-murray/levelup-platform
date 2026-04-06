'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';
import { entryWeight } from '@/lib/trends/trendsPageHelpers';
import type { DailyScoreRow, HabitEntryRow, HabitTemplateRow } from '@/lib/trends/trendsPageTypes';
import type { TrendsPeriodPreset } from '@/lib/trends/trendsRangeResolve';
import {
    addDays,
    enumerateDateKeysInclusive,
    priorWindowSameLength,
    resolveTrendsDateRange,
    todayLocal,
} from '@/lib/trends/trendsRangeResolve';
import { buildHabitBreakdownRows } from '@/lib/trends/trendsHabitBreakdown';

export type { TrendsPeriodPreset };

export type TrendsScoreStat = {
    label: string;
    percent: number | null;
    sublabel: string;
    empty: boolean;
    /** Shown under the ring when empty */
    emptyHint?: string;
};

export type TrendsScoreRow = {
    centerLabel: string;
    left: TrendsScoreStat;
    right: TrendsScoreStat;
};

function entryMap(entries: HabitEntryRow[]): Map<string, Map<string, HabitEntryRow['status']>> {
    const byHabit = new Map<string, Map<string, HabitEntryRow['status']>>();
    for (const e of entries) {
        if (!byHabit.has(e.habit_template_id)) byHabit.set(e.habit_template_id, new Map());
        byHabit.get(e.habit_template_id)!.set(e.date, e.status);
    }
    return byHabit;
}

function slotCompletionWeighted(
    templates: HabitTemplateRow[],
    byHabit: Map<string, Map<string, HabitEntryRow['status']>>,
    dateKeys: string[],
    slot: 'morning' | 'afternoon' | 'evening',
): { completed: number; total: number } {
    const eligible = templates.filter((t) => !t.is_bad_habit && t.time_of_day === slot);
    let total = 0;
    let completed = 0;
    for (const dateKey of dateKeys) {
        for (const t of eligible) {
            total += 1;
            const st = byHabit.get(t.id)?.get(dateKey) ?? 'missed';
            completed += entryWeight(st);
        }
    }
    return { completed, total };
}

function categoryCompletionWeighted(
    templates: HabitTemplateRow[],
    byHabit: Map<string, Map<string, HabitEntryRow['status']>>,
    dateKeys: string[],
    category: 'physical' | 'mental' | 'spiritual',
): { completed: number; total: number } {
    const eligible = templates.filter((t) => !t.is_bad_habit && t.category === category);
    let total = 0;
    let completed = 0;
    for (const dateKey of dateKeys) {
        for (const t of eligible) {
            total += 1;
            const st = byHabit.get(t.id)?.get(dateKey) ?? 'missed';
            completed += entryWeight(st);
        }
    }
    return { completed, total };
}

function formatWeightedRatio(completed: number): string {
    const r = Math.round(completed * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const SLOT_HINTS: Record<'morning' | 'afternoon' | 'evening', string> = {
    morning: 'No habits use Morning — set time of day on a habit',
    afternoon: 'No habits use Afternoon — set time of day on a habit',
    evening: 'No habits use Evening — set time of day on a habit',
};

const CATEGORY_HINTS: Record<'physical' | 'mental' | 'spiritual', string> = {
    physical: 'No active physical habits',
    mental: 'No active mental habits',
    spiritual: 'No active spiritual habits',
};

function statFromWeightedCompletion(
    label: string,
    completed: number,
    total: number,
    emptyHint: string,
): TrendsScoreStat {
    if (total === 0) {
        return { label, percent: null, sublabel: '0/0', empty: true, emptyHint };
    }
    const pct = Math.round((completed / total) * 1000) / 10;
    return {
        label,
        percent: pct,
        sublabel: `${formatWeightedRatio(completed)}/${total}`,
        empty: false,
    };
}

function buildStat(
    label: string,
    rows: DailyScoreRow[],
    totalDays: number,
    pick: (r: DailyScoreRow) => number,
    emptyHint = 'No scored days in this range — log habits to build a streak',
): TrendsScoreStat {
    if (rows.length === 0) {
        return { label, percent: null, sublabel: `0/${totalDays}`, empty: true, emptyHint };
    }
    const sum = rows.reduce((acc, r) => acc + pick(r), 0);
    const avg = sum / rows.length;
    return {
        label,
        percent: Math.round(avg * 10) / 10,
        sublabel: `${rows.length}/${totalDays}`,
        empty: false,
    };
}

function buildScoreRows(
    rows: DailyScoreRow[],
    totalDays: number,
    templates: HabitTemplateRow[],
    entries: HabitEntryRow[],
    startDateStr: string,
    endDateStr: string,
): TrendsScoreRow[] {
    const dateKeys = enumerateDateKeysInclusive(startDateStr, endDateStr);
    const byHabit = entryMap(entries);
    const morning = slotCompletionWeighted(templates, byHabit, dateKeys, 'morning');
    const afternoon = slotCompletionWeighted(templates, byHabit, dateKeys, 'afternoon');
    const evening = slotCompletionWeighted(templates, byHabit, dateKeys, 'evening');
    const physical = categoryCompletionWeighted(templates, byHabit, dateKeys, 'physical');
    const mental = categoryCompletionWeighted(templates, byHabit, dateKeys, 'mental');
    const spiritual = categoryCompletionWeighted(templates, byHabit, dateKeys, 'spiritual');

    return [
        {
            centerLabel: 'Overview',
            left: buildStat('Overall', rows, totalDays, (r) => r.score_overall),
            right: buildStat('Habit', rows, totalDays, (r) => r.score_habits),
        },
        {
            centerLabel: 'Tasks',
            left: buildStat('To do', rows, totalDays, (r) => r.score_todos),
            right: buildStat('Priority', rows, totalDays, (r) => r.score_priorities),
        },
        {
            centerLabel: 'Daytime',
            left: statFromWeightedCompletion('Morning', morning.completed, morning.total, SLOT_HINTS.morning),
            right: statFromWeightedCompletion(
                'Afternoon',
                afternoon.completed,
                afternoon.total,
                SLOT_HINTS.afternoon,
            ),
        },
        {
            centerLabel: 'Rhythm',
            left: statFromWeightedCompletion('Evening', evening.completed, evening.total, SLOT_HINTS.evening),
            right: statFromWeightedCompletion('Mental', mental.completed, mental.total, CATEGORY_HINTS.mental),
        },
        {
            centerLabel: 'Wellbeing',
            left: statFromWeightedCompletion(
                'Physical',
                physical.completed,
                physical.total,
                CATEGORY_HINTS.physical,
            ),
            right: statFromWeightedCompletion(
                'Spiritual',
                spiritual.completed,
                spiritual.total,
                CATEGORY_HINTS.spiritual,
            ),
        },
    ];
}

export type TrendsPageReadyModel = Omit<ReturnType<typeof useTrendsPageData>, 'loading'>;

export function useTrendsPageData() {
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [preset, setPreset] = useState<TrendsPeriodPreset>('weekly');
    const [customStart, setCustomStart] = useState(() => formatDate(addDays(todayLocal(), -6)));
    const [customEnd, setCustomEnd] = useState(() => formatDate(todayLocal()));
    const [scores, setScores] = useState<DailyScoreRow[]>([]);
    const [templates, setTemplates] = useState<HabitTemplateRow[]>([]);
    const [entries, setEntries] = useState<HabitEntryRow[]>([]);
    const [priorScores, setPriorScores] = useState<
        Pick<DailyScoreRow, 'score_overall' | 'score_habits'>[]
    >([]);

    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }
            setUserId(user.id);
        })();
    }, []);

    const { startDateStr, endDateStr, totalDays, rangeInvalid, rangeTooLong } = useMemo(
        () => resolveTrendsDateRange(preset, customStart, customEnd),
        [preset, customStart, customEnd],
    );

    useEffect(() => {
        if (!userId) return;

        const load = async () => {
            setLoading(true);
            try {
                const prior = priorWindowSameLength(startDateStr, totalDays);
                const priorQuery =
                    prior &&
                    supabase
                        .from('habit_daily_scores')
                        .select('score_overall, score_habits')
                        .eq('user_id', userId)
                        .gte('date', prior.priorStartStr)
                        .lte('date', prior.priorEndStr);

                const [
                    { data: scoreData },
                    { data: templateData },
                    { data: entryData },
                    priorResult,
                ] = await Promise.all([
                    supabase
                        .from('habit_daily_scores')
                        .select(
                            'date, score_overall, grade, score_habits, score_priorities, score_todos, score_physical, score_mental, score_spiritual, score_morning, score_afternoon, score_evening',
                        )
                        .eq('user_id', userId)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr)
                        .order('date', { ascending: true }),
                    supabase
                        .from('habit_templates')
                        .select('id, name, icon, category, time_of_day, is_bad_habit, is_active')
                        .eq('user_id', userId)
                        .eq('is_active', true)
                        .order('sort_order'),
                    supabase
                        .from('habit_daily_entries')
                        .select('habit_template_id, date, status')
                        .eq('user_id', userId)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr),
                    priorQuery ?? Promise.resolve({ data: [] as Pick<DailyScoreRow, 'score_overall' | 'score_habits'>[] }),
                ]);

                setScores((scoreData || []) as DailyScoreRow[]);
                setTemplates((templateData || []) as HabitTemplateRow[]);
                setEntries((entryData || []) as HabitEntryRow[]);
                setPriorScores((priorResult.data || []) as Pick<DailyScoreRow, 'score_overall' | 'score_habits'>[]);
            } catch (err) {
                console.error('Error loading trends:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [userId, startDateStr, endDateStr, totalDays]);

    const scoresChrono = useMemo(
        () => [...scores].sort((a, b) => a.date.localeCompare(b.date)),
        [scores],
    );

    const scoreRows = useMemo(
        () => buildScoreRows(scoresChrono, totalDays, templates, entries, startDateStr, endDateStr),
        [scoresChrono, totalDays, templates, entries, startDateStr, endDateStr],
    );

    const dateKeys = useMemo(
        () => enumerateDateKeysInclusive(startDateStr, endDateStr),
        [startDateStr, endDateStr],
    );

    const habitBreakdownRows = useMemo(
        () => buildHabitBreakdownRows(templates, entries, dateKeys),
        [templates, entries, dateKeys],
    );

    const scoreTrend = useMemo(() => {
        const priorLabel = `prior ${totalDays} day${totalDays === 1 ? '' : 's'}`;
        const mean = (rows: { score_overall: number; score_habits: number }[], key: 'score_overall' | 'score_habits') => {
            if (rows.length === 0) return null;
            return rows.reduce((a, r) => a + r[key], 0) / rows.length;
        };
        const curOverall = mean(scoresChrono, 'score_overall');
        const curHabit = mean(scoresChrono, 'score_habits');
        const prOverall = mean(priorScores, 'score_overall');
        const prHabit = mean(priorScores, 'score_habits');
        const round1 = (n: number) => Math.round(n * 10) / 10;
        return {
            priorLabel,
            overallDelta:
                curOverall != null && prOverall != null ? round1(curOverall - prOverall) : null,
            habitDelta: curHabit != null && prHabit != null ? round1(curHabit - prHabit) : null,
        };
    }, [scoresChrono, priorScores, totalDays]);

    const rangeSummary = useMemo(() => {
        if (preset === 'weekly') return 'Last 7 days';
        if (preset === 'monthly') return 'Last 30 days';
        if (rangeTooLong) return 'Custom range too long (max 365 days)';
        if (rangeInvalid) return 'Custom (fix dates below)';
        return `${startDateStr} → ${endDateStr}`;
    }, [preset, startDateStr, endDateStr, rangeInvalid, rangeTooLong]);

    return {
        loading,
        preset,
        setPreset,
        customStart,
        setCustomStart,
        customEnd,
        setCustomEnd,
        startDateStr,
        endDateStr,
        totalDays,
        rangeInvalid,
        rangeTooLong,
        rangeSummary,
        scoreRows,
        scoresChrono,
        habitBreakdownRows,
        scoreTrend,
    };
}
