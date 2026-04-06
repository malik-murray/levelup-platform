import type { QuestTrend } from '@/lib/trends/trendsCopy';

export type RangeOption = 7 | 14 | 30 | 60 | 90;

export type LaneFilter = 'all' | 'physical' | 'mental' | 'spiritual';

export type HabitTemplateRow = {
    id: string;
    name: string;
    icon: string;
    category: 'physical' | 'mental' | 'spiritual';
    time_of_day: 'morning' | 'afternoon' | 'evening' | null;
    is_bad_habit?: boolean;
    is_active?: boolean;
};

export type HabitEntryStatus = 'checked' | 'half' | 'missed';

export type HabitEntryRow = {
    habit_template_id: string;
    date: string;
    status: HabitEntryStatus;
};

export type DailyScoreRow = {
    date: string;
    score_overall: number;
    grade: string;
    score_habits: number;
    score_priorities: number;
    score_todos: number;
    score_physical: number;
    score_mental: number;
    score_spiritual: number;
    score_morning: number;
    score_afternoon: number;
    score_evening: number;
};

export type HabitTrend = {
    id: string;
    name: string;
    icon: string;
    category: string;
    completionRate: number;
    completedDays: number;
    totalDays: number;
    currentStreak: number;
    longestStreak: number;
    trend: QuestTrend;
    trendDelta: number;
    missedLast10: boolean;
    positiveSignals: string[];
    negativeSignals: string[];
    time_of_day: HabitTemplateRow['time_of_day'];
};

export const RANGE_OPTIONS: RangeOption[] = [7, 14, 30, 60, 90];
