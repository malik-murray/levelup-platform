import {
    calculateDailyScore,
    calculateItemScore,
    getGrade,
    type HabitStatus,
    type TimeOfDay,
} from '@/lib/habitHelpers';

export type HabitTemplateRow = {
    id: string;
    time_of_day: TimeOfDay | null;
    is_bad_habit: boolean;
};

export type HabitEntryRow = {
    habit_template_id: string;
    status: HabitStatus | string;
};

export type PriorityRow = {
    completed: boolean;
};

export type TodoRow = {
    is_done: boolean;
};

export type SlotScore = {
    score: number;
    grade: string;
    checked: number;
    total: number;
};

export type DailyScoreSnapshot = {
    scoreOverall: number;
    gradeOverall: string;
    scoreHabits: number;
    scorePriorities: number;
    scoreTodos: number;
    morning: SlotScore | null;
    afternoon: SlotScore | null;
    evening: SlotScore | null;
};

export function habitsForTimeSlot(
    templates: HabitTemplateRow[],
    slot: TimeOfDay
): HabitTemplateRow[] {
    return templates.filter(t => {
        if (t.is_bad_habit) return false;
        if (slot === 'morning') {
            return t.time_of_day === 'morning' || t.time_of_day == null;
        }
        return t.time_of_day === slot;
    });
}

export function computeSlotScore(
    templates: HabitTemplateRow[],
    entries: HabitEntryRow[],
    slot: TimeOfDay
): SlotScore | null {
    const slotHabits = habitsForTimeSlot(templates, slot);
    if (slotHabits.length === 0) return null;

    const checked = slotHabits.filter(h => {
        const entry = entries.find(e => e.habit_template_id === h.id);
        return entry?.status === 'checked';
    }).length;

    const score = Math.round((checked / slotHabits.length) * 100);
    return {
        score,
        grade: getGrade(score),
        checked,
        total: slotHabits.length,
    };
}

export function computeDailyScoreSnapshot(input: {
    templates: HabitTemplateRow[];
    entries: HabitEntryRow[];
    priorities: PriorityRow[];
    todos: TodoRow[];
}): DailyScoreSnapshot {
    const goodTemplates = input.templates.filter(t => !t.is_bad_habit);
    const badTemplates = input.templates.filter(t => t.is_bad_habit);

    const goodStatuses = goodTemplates.map(t => {
        const entry = input.entries.find(e => e.habit_template_id === t.id);
        return { status: (entry?.status ?? 'missed') as HabitStatus };
    });

    const goodHabitsScore =
        goodTemplates.length > 0
            ? calculateItemScore(goodStatuses, goodTemplates.length)
            : 0;

    const checkedBadCount = badTemplates.filter(t => {
        const entry = input.entries.find(e => e.habit_template_id === t.id);
        return entry?.status === 'checked';
    }).length;

    const scoreHabits = Math.max(0, goodHabitsScore - checkedBadCount * 3);
    const scorePriorities = calculateItemScore(
        input.priorities.map(p => ({ completed: p.completed })),
        Math.max(1, input.priorities.length)
    );
    const scoreTodos = calculateItemScore(
        input.todos.map(t => ({ is_done: t.is_done })),
        Math.max(1, input.todos.length)
    );
    const scoreOverall = calculateDailyScore(scoreHabits, scorePriorities, scoreTodos);

    return {
        scoreOverall,
        gradeOverall: getGrade(scoreOverall),
        scoreHabits,
        scorePriorities,
        scoreTodos,
        morning: computeSlotScore(input.templates, input.entries, 'morning'),
        afternoon: computeSlotScore(input.templates, input.entries, 'afternoon'),
        evening: computeSlotScore(input.templates, input.entries, 'evening'),
    };
}
