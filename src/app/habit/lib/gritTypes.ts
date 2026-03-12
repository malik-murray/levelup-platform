/**
 * Shared types for GRIT-style Habits UI.
 * Maps to existing habit_templates (name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order).
 */

export type GritHabitType = 'good' | 'bad' | 'track' | 'todo';

export type Category = 'physical' | 'mental' | 'spiritual';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface GritHabitTemplate {
  id: string;
  name: string;
  icon: string;
  category: Category;
  time_of_day: TimeOfDay | null;
  goal_id: string | null;
  is_bad_habit: boolean;
  is_active: boolean;
  sort_order: number | null;
  /** UI-only: derived type for GRIT (good/bad/track/todo) */
  type?: GritHabitType;
  /** UI-only: for future DB column */
  color?: string;
  /** UI-only: for future DB column */
  description?: string | null;
}

export interface GritHabitEntry {
  id: string;
  habit_template_id: string;
  date: string;
  status: 'checked' | 'half' | 'missed';
  checked_at: string | null;
}

/** Draft for new/edit form; supports "coming soon" fields */
export interface GritHabitFormDraft {
  name: string;
  icon: string;
  category: Category;
  time_of_day: TimeOfDay | null;
  is_bad_habit: boolean;
  goal_id: string | null;
  type: GritHabitType;
  color?: string;
  description?: string | null;
  /** Coming soon */
  groupIds?: string[];
  goal?: string | null;
  average?: string | null;
  repeat?: string | null;
  notifications?: boolean;
  url?: string | null;
  starts_on?: string | null;
  ends?: string | null;
}

export const DEFAULT_HABIT_FORM: GritHabitFormDraft = {
  name: '',
  icon: '📝',
  category: 'mental',
  time_of_day: null,
  is_bad_habit: false,
  goal_id: null,
  type: 'good',
  color: undefined,
  description: null,
};

/** Map DB habit_template to GritHabitTemplate (derive type from is_bad_habit) */
export function dbToGrit(t: {
  id: string;
  name: string;
  icon: string;
  category: Category;
  time_of_day: TimeOfDay | null;
  goal_id: string | null;
  is_bad_habit: boolean;
  is_active: boolean;
  sort_order: number | null;
}): GritHabitTemplate {
  const type: GritHabitType = t.is_bad_habit ? 'bad' : 'good';
  return { ...t, type };
}

/** Map GritHabitFormDraft to DB insert/update payload (only existing columns) */
export function draftToDb(d: GritHabitFormDraft) {
  return {
    name: d.name.trim(),
    icon: d.icon,
    category: d.category,
    time_of_day: d.time_of_day,
    is_bad_habit: d.type === 'bad',
    goal_id: d.goal_id,
  };
}
