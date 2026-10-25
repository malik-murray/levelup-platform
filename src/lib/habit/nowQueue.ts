import type { TimeOfDay } from '@/lib/habitHelpers';
import { daysUntilDue, focusScore, type FocusTask } from '@/lib/habit/focusScore';
import { buildOperationQueue, timeOfDayLabel, type OperationHabit } from '@/lib/habit/operationOrder';

export type DayPart = 'morning' | 'afternoon' | 'evening';

const PART_RANK: Record<DayPart, number> = {
    morning: 0,
    afternoon: 1,
    evening: 2,
};

export type NowQueueItem = {
    kind: 'habit' | 'task';
    id: string;
    title: string;
    icon: string | null;
    done: boolean;
    detail: string;
    timeOfDay: TimeOfDay | null;
    score: number | null;
};

function dueDetail(task: FocusTask, day: string): string {
    if (!task.due_date) return 'Backlog';
    const days = daysUntilDue(task.due_date, day);
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days}d`;
}

function byScore(day: string) {
    return (a: FocusTask, b: FocusTask) => (focusScore(b, day) ?? 0) - (focusScore(a, day) ?? 0);
}

function isOpen(task: FocusTask, day: string): boolean {
    return focusScore(task, day) != null;
}

/** Overdue backlog work first, then the routine up to now, then tasks due today, then the rest of the day. */
export function buildNowQueue(input: {
    habits: OperationHabit[];
    tasks: FocusTask[];
    day: string;
    part: DayPart;
}): { items: NowQueueItem[]; now: NowQueueItem | null } {
    const currentRank = PART_RANK[input.part];
    const steps = buildOperationQueue(input.habits).steps;
    const openTasks = input.tasks.filter((task) => isOpen(task, input.day));
    const doneTasks = input.tasks.filter((task) => !isOpen(task, input.day));

    const overdue = openTasks
        .filter((task) => task.due_date && daysUntilDue(task.due_date, input.day) < 0)
        .sort(byScore(input.day));
    const overdueIds = new Set(overdue.map((task) => task.id));
    const dueToday = openTasks
        .filter((task) => {
            if (overdueIds.has(task.id)) return false;
            if (task.assigned_date === input.day) return true;
            return Boolean(task.due_date) && daysUntilDue(task.due_date as string, input.day) === 0;
        })
        .sort(byScore(input.day));
    const placed = new Set([...overdueIds, ...dueToday.map((task) => task.id)]);
    const laterTasks = openTasks.filter((task) => !placed.has(task.id)).sort(byScore(input.day));

    const habitItems: NowQueueItem[] = steps.map((step) => ({
        kind: 'habit',
        id: step.id,
        title: step.name,
        icon: step.icon,
        done: step.done,
        detail: timeOfDayLabel(step.time_of_day),
        timeOfDay: step.time_of_day,
        score: null,
    }));

    const habitRank = (item: NowQueueItem) => {
        if (!item.timeOfDay) return currentRank;
        return PART_RANK[item.timeOfDay];
    };
    const routineNow = habitItems.filter((item) => habitRank(item) <= currentRank);
    const routineLater = habitItems.filter((item) => habitRank(item) > currentRank);

    const taskItem = (task: FocusTask, done: boolean): NowQueueItem => ({
        kind: 'task',
        id: task.id,
        title: task.title,
        icon: null,
        done,
        detail: dueDetail(task, input.day),
        timeOfDay: null,
        score: focusScore(task, input.day),
    });

    const items = [
        ...overdue.map((task) => taskItem(task, false)),
        ...routineNow,
        ...dueToday.map((task) => taskItem(task, false)),
        ...routineLater,
        ...laterTasks.map((task) => taskItem(task, false)),
        ...doneTasks.map((task) => taskItem(task, true)),
    ];

    return {
        items,
        now: items.find((item) => !item.done) ?? null,
    };
}
