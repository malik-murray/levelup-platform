export type EisenhowerQuadrant = 'q1' | 'q2' | 'q3' | 'q4' | 'unclassified';

export type EisenhowerFields = {
    is_important: boolean | null;
    is_urgent: boolean | null;
};

export const QUADRANT_META: Record<
    EisenhowerQuadrant,
    { label: string; shortLabel: string; description: string; sortOrder: number }
> = {
    q1: {
        label: 'Important & Urgent',
        shortLabel: 'Q1',
        description: 'Do first — crises and deadlines',
        sortOrder: 0,
    },
    q2: {
        label: 'Important & Not Urgent',
        shortLabel: 'Q2',
        description: 'Schedule — growth and planning',
        sortOrder: 1,
    },
    q3: {
        label: 'Not Important & Urgent',
        shortLabel: 'Q3',
        description: 'Delegate or batch — interruptions',
        sortOrder: 2,
    },
    q4: {
        label: 'Not Important & Not Urgent',
        shortLabel: 'Q4',
        description: 'Eliminate — distractions and busywork',
        sortOrder: 3,
    },
    unclassified: {
        label: 'Unclassified',
        shortLabel: '?',
        description: 'Mark important or urgent to prioritize',
        sortOrder: 4,
    },
};

export function normalizeEisenhowerFields(fields: EisenhowerFields): {
    is_important: boolean;
    is_urgent: boolean;
} {
    return {
        is_important: fields.is_important ?? false,
        is_urgent: fields.is_urgent ?? false,
    };
}

export function getQuadrant(fields: EisenhowerFields): EisenhowerQuadrant {
    const { is_important, is_urgent } = normalizeEisenhowerFields(fields);
    if (is_important && is_urgent) return 'q1';
    if (is_important && !is_urgent) return 'q2';
    if (!is_important && is_urgent) return 'q3';
    return 'q4';
}

export function getQuadrantSortOrder(fields: EisenhowerFields): number {
    return QUADRANT_META[getQuadrant(fields)].sortOrder;
}

export function compareByQuadrant<T extends EisenhowerFields>(
    a: T,
    b: T,
    secondaryCompare: (a: T, b: T) => number = () => 0
): number {
    const quadrantDiff = getQuadrantSortOrder(a) - getQuadrantSortOrder(b);
    if (quadrantDiff !== 0) return quadrantDiff;
    return secondaryCompare(a, b);
}

export function suggestClassification(input: {
    goal_id?: string | null;
    due_date?: string | null;
    assigned_date?: string | null;
    today?: string;
}): EisenhowerFields {
    const today = input.today ?? new Date().toISOString().slice(0, 10);
    const isImportant = Boolean(input.goal_id);
    const dueOrAssigned = input.due_date ?? input.assigned_date;
    const isUrgent = dueOrAssigned ? dueOrAssigned <= today : false;
    return {
        is_important: isImportant,
        is_urgent: isUrgent,
    };
}

export function quadrantBadgeClasses(quadrant: EisenhowerQuadrant): string {
    switch (quadrant) {
        case 'q1':
            return 'border-red-400/50 bg-red-500/15 text-red-200';
        case 'q2':
            return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200';
        case 'q3':
            return 'border-amber-400/50 bg-amber-500/15 text-amber-200';
        case 'q4':
            return 'border-slate-500/50 bg-slate-500/15 text-slate-300';
        default:
            return 'border-[#ff9d00]/35 bg-[#ff9d00]/10 text-slate-400';
    }
}
