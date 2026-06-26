import type { GoalDueDateFilter, HabitGoal } from './types';

function startOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(d: Date): Date {
  const next = startOfDay(d);
  const day = next.getDay();
  const daysUntilSunday = 7 - day;
  next.setDate(next.getDate() + daysUntilSunday);
  return next;
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function matchesDueDateFilter(goal: HabitGoal, filter: GoalDueDateFilter): boolean {
  if (filter === 'all') return true;
  if (!goal.deadline) return filter === 'no-deadline';
  if (filter === 'no-deadline') return false;

  const today = startOfDay(new Date());
  const deadline = startOfDay(new Date(`${goal.deadline}T00:00:00`));

  switch (filter) {
    case 'overdue':
      return !goal.is_completed && deadline < today;
    case 'this-week':
      return deadline >= today && deadline <= endOfWeek(today);
    case 'this-month':
      return deadline >= today && deadline <= endOfMonth(today);
    default:
      return true;
  }
}

export function sortGoals<T extends HabitGoal>(goals: T[]): T[] {
  return [...goals].sort((a, b) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    const aOrder = a.sort_order ?? 9999;
    const bOrder = b.sort_order ?? 9999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aDeadline = a.deadline ?? '9999-12-31';
    const bDeadline = b.deadline ?? '9999-12-31';
    if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);
    return (b.priority_score ?? 0) - (a.priority_score ?? 0);
  });
}
