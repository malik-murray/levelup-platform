import type { HabitGoal, HabitMilestone } from './types';

export function parseMilestoneValues(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
}

export function milestoneProgressPercent(milestone: HabitMilestone): number {
  const values = parseMilestoneValues(milestone.values);
  const current = milestone.current_value ?? 0;

  if (milestone.is_completed) return 100;
  if (values.length === 0) return 0;

  const max = values[values.length - 1];
  if (max <= 0) return milestone.is_completed ? 100 : 0;
  return Math.min(100, Math.round((current / max) * 100));
}

export function milestoneNextThreshold(milestone: HabitMilestone): number | null {
  const values = parseMilestoneValues(milestone.values);
  const current = milestone.current_value ?? 0;
  return values.find((v) => v > current) ?? null;
}

export function goalProgressPercent(
  goal: HabitGoal,
  milestones: HabitMilestone[]
): number {
  if (goal.is_completed) return 100;

  if (goal.target_value != null && goal.target_value > 0) {
    const current = goal.current_value ?? 0;
    return Math.min(100, Math.round((current / goal.target_value) * 100));
  }

  const active = milestones.filter((m) => !m.is_archived);
  if (active.length === 0) return 0;

  const completed = active.filter(
    (m) => m.is_completed || (parseMilestoneValues(m.values).length === 0 && m.is_completed)
  ).length;

  const withProgress = active.map((m) => {
    if (m.is_completed) return 100;
    const values = parseMilestoneValues(m.values);
    if (values.length === 0) return m.is_completed ? 100 : 0;
    return milestoneProgressPercent(m);
  });

  const avg = withProgress.reduce((sum, p) => sum + p, 0) / withProgress.length;
  const completionRatio = (completed / active.length) * 100;
  return Math.round(Math.max(avg, completionRatio * 0.5));
}

export function linkedItemsSummary(items: { type: string; completed: boolean }[]): {
  total: number;
  completed: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  let completed = 0;
  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    if (item.completed) completed += 1;
  }
  return { total: items.length, completed, byType };
}
