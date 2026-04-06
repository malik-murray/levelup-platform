import { entryWeight } from '@/lib/trends/trendsPageHelpers';
import type { HabitEntryRow, HabitTemplateRow } from '@/lib/trends/trendsPageTypes';

export type HabitBreakdownRow = {
    id: string;
    name: string;
    icon: string;
    category: string;
    timeLabel: string;
    completed: number;
    total: number;
    pct: number;
};

function timeLabel(t: HabitTemplateRow): string {
    if (t.time_of_day) return t.time_of_day.charAt(0).toUpperCase() + t.time_of_day.slice(1);
    return 'Any time';
}

export function buildHabitBreakdownRows(
    templates: HabitTemplateRow[],
    entries: HabitEntryRow[],
    dateKeys: string[],
): HabitBreakdownRow[] {
    const byHabit = new Map<string, Map<string, HabitEntryRow['status']>>();
    for (const e of entries) {
        if (!byHabit.has(e.habit_template_id)) byHabit.set(e.habit_template_id, new Map());
        byHabit.get(e.habit_template_id)!.set(e.date, e.status);
    }

    const active = templates.filter((t) => !t.is_bad_habit);
    const rows: HabitBreakdownRow[] = active.map((t) => {
        let total = 0;
        let completed = 0;
        for (const dateKey of dateKeys) {
            total += 1;
            const st = byHabit.get(t.id)?.get(dateKey) ?? 'missed';
            completed += entryWeight(st);
        }
        const pct = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
        return {
            id: t.id,
            name: t.name,
            icon: t.icon,
            category: t.category,
            timeLabel: timeLabel(t),
            completed,
            total,
            pct,
        };
    });

    return rows.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
}
