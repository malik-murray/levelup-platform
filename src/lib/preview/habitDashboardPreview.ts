import type {
    PreviewContextValue,
    PreviewHabitEntry,
    PreviewHabitTemplate,
    PreviewPriority,
    PreviewTodo,
} from '@/lib/previewStore';
import type { Category, HabitStatus } from '@/lib/habitHelpers';

export function ensureGuestSampleHabits(preview: PreviewContextValue): void {
    if (preview.habit.habitTemplates.length > 0) return;

    const samples: PreviewHabitTemplate[] = [
        {
            id: preview.generateId(),
            name: 'Morning workout',
            icon: '💪',
            category: 'physical',
            time_of_day: 'morning',
            goal_id: null,
            is_bad_habit: false,
            is_active: true,
            sort_order: 0,
        },
        {
            id: preview.generateId(),
            name: 'Read 20 minutes',
            icon: '📚',
            category: 'mental',
            time_of_day: 'evening',
            goal_id: null,
            is_bad_habit: false,
            is_active: true,
            sort_order: 1,
        },
        {
            id: preview.generateId(),
            name: 'Meditate',
            icon: '🧘',
            category: 'spiritual',
            time_of_day: 'morning',
            goal_id: null,
            is_bad_habit: false,
            is_active: true,
            sort_order: 2,
        },
    ];

    preview.setHabit((prev) => ({
        ...prev,
        habitTemplates: samples,
    }));
}

export function getPreviewHabitDataForDate(preview: PreviewContextValue, dateStr: string) {
    const templates = preview.habit.habitTemplates
        .filter((t) => t.is_active)
        .map((t) => ({
            ...t,
            categories: t.categories ?? [t.category],
        }));

    const entries = preview.habit.habitEntries.filter((e) => e.date === dateStr);
    const priorities = preview.habit.priorities.filter((p) => (p.date ?? dateStr) === dateStr);
    const todos = preview.habit.todos.filter((t) => (t.date ?? dateStr) === dateStr);
    const score = preview.habit.dailyScores[dateStr] ?? null;

    return { templates, entries, priorities, todos, score };
}

export function upsertPreviewHabitEntry(
    preview: PreviewContextValue,
    dateStr: string,
    templateId: string,
    status: HabitStatus,
    checkedAt: string | null
) {
    preview.setHabit((prev) => {
        const existing = prev.habitEntries.find(
            (e) => e.date === dateStr && e.habit_template_id === templateId
        );
        const habitEntries = existing
            ? prev.habitEntries.map((e) =>
                  e.id === existing.id ? { ...e, status, checked_at: checkedAt } : e
              )
            : [
                  ...prev.habitEntries,
                  {
                      id: preview.generateId(),
                      habit_template_id: templateId,
                      date: dateStr,
                      status,
                      checked_at: checkedAt,
                  } satisfies PreviewHabitEntry,
              ];
        return { ...prev, habitEntries };
    });
}

export function upsertPreviewPriority(
    preview: PreviewContextValue,
    dateStr: string,
    slotIndex: number,
    text: string,
    existing?: Pick<PreviewPriority, 'id'>
) {
    preview.setHabit((prev) => {
        if (existing) {
            return {
                ...prev,
                priorities: prev.priorities.map((p) =>
                    p.id === existing.id ? { ...p, text, date: dateStr } : p
                ),
            };
        }
        const priority: PreviewPriority = {
            id: preview.generateId(),
            text,
            category: null,
            time_of_day: null,
            completed: false,
            goal_id: null,
            completed_at: null,
            date: dateStr,
            sort_order: slotIndex,
        };
        return { ...prev, priorities: [...prev.priorities, priority] };
    });
}

export function deletePreviewPriority(preview: PreviewContextValue, id: string) {
    preview.setHabit((prev) => ({
        ...prev,
        priorities: prev.priorities.filter((p) => p.id !== id),
    }));
}

export function upsertPreviewTodo(
    preview: PreviewContextValue,
    dateStr: string,
    title: string,
    existing?: Pick<PreviewTodo, 'id'>
) {
    preview.setHabit((prev) => {
        if (existing) {
            return {
                ...prev,
                todos: prev.todos.map((t) => (t.id === existing.id ? { ...t, title, date: dateStr } : t)),
            };
        }
        const todo: PreviewTodo = {
            id: preview.generateId(),
            title,
            category: null,
            time_of_day: null,
            is_done: false,
            goal_id: null,
            completed_at: null,
            date: dateStr,
        };
        return { ...prev, todos: [...prev.todos, todo] };
    });
}

export function deletePreviewTodo(preview: PreviewContextValue, id: string) {
    preview.setHabit((prev) => ({
        ...prev,
        todos: prev.todos.filter((t) => t.id !== id),
    }));
}

export function togglePreviewPriorityComplete(
    preview: PreviewContextValue,
    id: string,
    completed: boolean
) {
    preview.setHabit((prev) => ({
        ...prev,
        priorities: prev.priorities.map((p) =>
            p.id === id
                ? { ...p, completed, completed_at: completed ? new Date().toISOString() : null }
                : p
        ),
    }));
}

export function togglePreviewTodoDone(preview: PreviewContextValue, id: string, isDone: boolean) {
    preview.setHabit((prev) => ({
        ...prev,
        todos: prev.todos.map((t) =>
            t.id === id
                ? { ...t, is_done: isDone, completed_at: isDone ? new Date().toISOString() : null }
                : t
        ),
    }));
}

export function savePreviewDailyScore(
    preview: PreviewContextValue,
    dateStr: string,
    snapshot: {
        scoreOverall: number;
        gradeOverall: string;
        scoreHabits: number;
        scorePriorities: number;
        scoreTodos: number;
        scorePhysical: number;
        scoreMental: number;
        scoreSpiritual: number;
        scoreMorning: number;
        scoreAfternoon: number;
        scoreEvening: number;
    }
) {
    preview.setHabit((prev) => ({
        ...prev,
        dailyScores: {
            ...prev.dailyScores,
            [dateStr]: {
                score_overall: snapshot.scoreOverall,
                grade: snapshot.gradeOverall,
                score_habits: snapshot.scoreHabits,
                score_priorities: snapshot.scorePriorities,
                score_todos: snapshot.scoreTodos,
                score_physical: snapshot.scorePhysical,
                score_mental: snapshot.scoreMental,
                score_spiritual: snapshot.scoreSpiritual,
                score_morning: snapshot.scoreMorning,
                score_afternoon: snapshot.scoreAfternoon,
                score_evening: snapshot.scoreEvening,
                date: dateStr,
            },
        },
    }));
}

export type PreviewDailyNotes = {
    notes: string | null;
    lessons: string | null;
    feelings: string | null;
    ideas: string | null;
    reflection: string | null;
};

export function getPreviewDailyNotes(preview: PreviewContextValue, dateStr: string): PreviewDailyNotes {
    const row = preview.habit.dailyContent[dateStr];
    return {
        notes: row?.notes ?? null,
        lessons: row?.lessons ?? null,
        feelings: (row as { feelings?: string } | undefined)?.feelings ?? null,
        ideas: row?.ideas ?? null,
        reflection: row?.reflection ?? null,
    };
}

export function savePreviewDailyNoteField(
    preview: PreviewContextValue,
    dateStr: string,
    field: keyof PreviewDailyNotes,
    value: string | null
) {
    preview.setHabit((prev) => ({
        ...prev,
        dailyContent: {
            ...prev.dailyContent,
            [dateStr]: {
                ...prev.dailyContent[dateStr],
                notes: prev.dailyContent[dateStr]?.notes ?? null,
                lessons: prev.dailyContent[dateStr]?.lessons ?? null,
                ideas: prev.dailyContent[dateStr]?.ideas ?? null,
                reflection: prev.dailyContent[dateStr]?.reflection ?? null,
                distractions: prev.dailyContent[dateStr]?.distractions ?? null,
                [field]: value,
            },
        },
    }));
}

export function categoryFromPreview(category: Category): Category {
    return category;
}
