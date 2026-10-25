import type { TimeOfDay } from '@/lib/habitHelpers';

export type OperationStatus = 'checked' | 'half' | 'missed';

export type OperationHabit = {
    id: string;
    name: string;
    icon: string | null;
    time_of_day: TimeOfDay | null;
    sort_order: number | null;
    is_bad_habit?: boolean;
    status: OperationStatus;
};

export type OperationStep<T extends OperationHabit = OperationHabit> = T & {
    step: number;
    done: boolean;
};

const TIME_RANK: Record<TimeOfDay, number> = {
    morning: 0,
    afternoon: 1,
    evening: 2,
};

export function timeOfDayLabel(time: TimeOfDay | null): string {
    if (time === 'morning') return 'Morning';
    if (time === 'afternoon') return 'Afternoon';
    if (time === 'evening') return 'Evening';
    return 'Anytime';
}

/** Day-part first, then each habit's own position inside that part. */
export function compareOperationOrder(a: OperationHabit, b: OperationHabit): number {
    const timeA = a.time_of_day ? TIME_RANK[a.time_of_day] : 3;
    const timeB = b.time_of_day ? TIME_RANK[b.time_of_day] : 3;
    if (timeA !== timeB) return timeA - timeB;

    const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    return a.name.localeCompare(b.name);
}

export function buildOperationQueue<T extends OperationHabit>(habits: T[]): {
    steps: OperationStep<T>[];
    now: OperationStep<T> | null;
    completedCount: number;
} {
    const steps = habits
        .filter((habit) => !habit.is_bad_habit)
        .slice()
        .sort(compareOperationOrder)
        .map((habit, index) => ({
            ...habit,
            step: index + 1,
            done: habit.status === 'checked',
        }));

    return {
        steps,
        now: steps.find((step) => !step.done) ?? null,
        completedCount: steps.filter((step) => step.done).length,
    };
}
