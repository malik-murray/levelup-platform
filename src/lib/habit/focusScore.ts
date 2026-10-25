import { getQuadrant, type EisenhowerFields } from '@/lib/habit/eisenhower';

/** Matches the task tracker: P1=40, P2=30, P3=20, P4=10. */
export type FocusStatus = 'not_started' | 'in_progress' | 'blocked' | 'waiting' | 'done' | 'cancelled';

export type FocusTask = EisenhowerFields & {
    id: string;
    title: string;
    due_date?: string | null;
    assigned_date?: string | null;
    completed_at?: string | null;
    status?: FocusStatus | null;
};

const PRIORITY_POINTS = { q1: 40, q2: 30, q3: 20, q4: 10 } as const;

export function daysUntilDue(dueDate: string, today: string): number {
    const [dueYear, dueMonth, dueDay] = dueDate.slice(0, 10).split('-').map(Number);
    const [todayYear, todayMonth, todayDay] = today.slice(0, 10).split('-').map(Number);
    const dueUtc = Date.UTC(dueYear, dueMonth - 1, dueDay);
    const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
    return Math.round((dueUtc - todayUtc) / 86_400_000);
}

export function priorityPoints(fields: EisenhowerFields): number {
    const quadrant = getQuadrant(fields);
    return PRIORITY_POINTS[quadrant === 'unclassified' ? 'q4' : quadrant];
}

export function dueUrgencyPoints(dueDate: string | null | undefined, today: string): number {
    if (!dueDate) return 0;
    const days = daysUntilDue(dueDate, today);
    if (days < 0) return 50;
    if (days === 0) return 40;
    if (days <= 3) return 25;
    if (days <= 7) return 15;
    return 0;
}

export function focusScore(task: FocusTask, today: string): number | null {
    if (task.completed_at || task.status === 'done' || task.status === 'cancelled') return null;
    const followUp = task.status === 'blocked' || task.status === 'waiting' ? 10 : 0;
    return priorityPoints(task) + dueUrgencyPoints(task.due_date, today) + followUp;
}

export function completedOnDay(completedAt: string | null | undefined, day: string): boolean {
    if (!completedAt) return false;
    const completed = new Date(completedAt);
    if (Number.isNaN(completed.getTime())) return false;
    const year = completed.getFullYear();
    const month = String(completed.getMonth() + 1).padStart(2, '0');
    const date = String(completed.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}` === day;
}

/** Open work that belongs on this day, highest focus score first. */
export function tasksForDay<T extends FocusTask>(tasks: T[], day: string, limit = 10): T[] {
    const ranked = tasks
        .map((task) => ({ task, score: focusScore(task, day) }))
        .filter(({ task, score }) => {
            if (completedOnDay(task.completed_at, day)) return true;
            if (score == null) return false;
            if (task.assigned_date === day) return true;
            const quadrant = getQuadrant(task);
            if (!task.due_date && quadrant === 'q1') return true;
            if (!task.due_date) return false;
            return daysUntilDue(task.due_date, day) <= 7;
        })
        .sort((a, b) => {
            const aDone = completedOnDay(a.task.completed_at, day);
            const bDone = completedOnDay(b.task.completed_at, day);
            if (aDone !== bDone) return aDone ? 1 : -1;
            return (b.score ?? 0) - (a.score ?? 0);
        });

    const open = ranked.filter((item) => !completedOnDay(item.task.completed_at, day));
    const done = ranked.filter((item) => completedOnDay(item.task.completed_at, day));
    return [...open.slice(0, limit), ...done].map((item) => item.task);
}

export type FocusSummary = {
    open: number;
    overdue: number;
    dueToday: number;
    dueNext7: number;
};

export function focusSummary(tasks: FocusTask[], today: string): FocusSummary {
    const summary: FocusSummary = { open: 0, overdue: 0, dueToday: 0, dueNext7: 0 };
    for (const task of tasks) {
        if (focusScore(task, today) == null) continue;
        summary.open += 1;
        if (!task.due_date) continue;
        const days = daysUntilDue(task.due_date, today);
        if (days < 0) summary.overdue += 1;
        else if (days === 0) summary.dueToday += 1;
        else if (days <= 7) summary.dueNext7 += 1;
    }
    return summary;
}
