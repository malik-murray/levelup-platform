'use client';

import type { GritHabitFormDraft, GritHabitTemplate } from './gritTypes';
import { DEFAULT_HABIT_FORM, draftToDb, dbToGrit } from './gritTypes';

const STORAGE_KEY = 'grit_habit_form_draft';
const RETURN_KEY = 'grit_habit_return';

export function getStoredDraft(): GritHabitFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GritHabitFormDraft;
  } catch {
    return null;
  }
}

export function setStoredDraft(draft: GritHabitFormDraft | null): void {
  if (typeof window === 'undefined') return;
  if (draft === null) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function getReturnPath(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(RETURN_KEY);
}

export function setReturnPath(path: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(RETURN_KEY, path);
}

export function clearReturnPath(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RETURN_KEY);
}

/** Initialize draft from template selection (name, icon, type) or from existing habit */
export function initDraftFromTemplate(template: {
  name: string;
  icon: string;
  type: 'good' | 'health' | 'bad' | 'todo';
}): GritHabitFormDraft {
  const type: import('./gritTypes').GritHabitType = template.type === 'health' ? 'good' : template.type;
  return {
    ...DEFAULT_HABIT_FORM,
    name: template.name,
    icon: template.icon,
    type,
    is_bad_habit: type === 'bad',
  };
}

export function initDraftFromHabit(habit: GritHabitTemplate): GritHabitFormDraft {
  return {
    ...DEFAULT_HABIT_FORM,
    name: habit.name,
    icon: habit.icon,
    category: habit.category,
    time_of_day: habit.time_of_day,
    is_bad_habit: habit.is_bad_habit,
    goal_id: habit.goal_id,
    type: habit.type ?? (habit.is_bad_habit ? 'bad' : 'good'),
  };
}

export { DEFAULT_HABIT_FORM, draftToDb, dbToGrit };
