/**
 * Shared types for GRIT-style Habits UI.
 * Maps to habit_templates plus habit_template_goals / habit_template_categories.
 */

export type GritHabitType = 'good' | 'bad' | 'track' | 'todo';

export type Category = 'physical' | 'mental' | 'spiritual';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface GritHabitTemplate {
  id: string;
  name: string;
  icon: string;
  /** Primary category (legacy mirror of first linked category) */
  category: Category;
  categories?: Category[];
  time_of_day: TimeOfDay | null;
  /** Primary goal (legacy mirror of first linked goal) */
  goal_id: string | null;
  goal_ids?: string[];
  is_bad_habit: boolean;
  is_active: boolean;
  sort_order: number | null;
  type?: GritHabitType;
  color?: string;
  description?: string | null;
}

export interface GritHabitEntry {
  id: string;
  habit_template_id: string;
  date: string;
  status: 'checked' | 'half' | 'missed';
  checked_at: string | null;
}

export interface GritHabitFormDraft {
  name: string;
  icon: string;
  category: Category;
  categories: Category[];
  time_of_day: TimeOfDay | null;
  is_bad_habit: boolean;
  goal_id: string | null;
  goal_ids: string[];
  type: GritHabitType;
  color?: string;
  description?: string | null;
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
  categories: ['mental'],
  time_of_day: null,
  is_bad_habit: false,
  goal_id: null,
  goal_ids: [],
  type: 'good',
  color: undefined,
  description: null,
};

export function dbToGrit(t: {
  id: string;
  name: string;
  icon: string;
  category: Category;
  categories?: Category[];
  time_of_day: TimeOfDay | null;
  goal_id: string | null;
  goal_ids?: string[];
  is_bad_habit: boolean;
  is_active: boolean;
  sort_order: number | null;
}): GritHabitTemplate {
  const type: GritHabitType = t.is_bad_habit ? 'bad' : 'good';
  const categories = t.categories?.length ? t.categories : [t.category];
  const goal_ids = t.goal_ids?.length ? t.goal_ids : t.goal_id ? [t.goal_id] : [];
  return {
    ...t,
    categories,
    goal_ids,
    category: categories[0] ?? t.category,
    goal_id: goal_ids[0] ?? null,
    type,
  };
}

export function draftToDb(d: GritHabitFormDraft) {
  const categories = d.categories.length > 0 ? d.categories : [d.category];
  const goal_ids = d.goal_ids.length > 0 ? d.goal_ids : d.goal_id ? [d.goal_id] : [];
  return {
    name: d.name.trim(),
    icon: d.icon,
    category: categories[0] ?? 'mental',
    time_of_day: d.time_of_day,
    is_bad_habit: d.type === 'bad',
    goal_id: goal_ids[0] ?? null,
  };
}

export function formatCategoriesLabel(categories: Category[]): string {
  if (categories.length === 0) return 'None';
  return categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
}

export function formatGoalsLabel(goalIds: string[], count?: number): string {
  const n = count ?? goalIds.length;
  if (n === 0) return 'None';
  if (n === 1) return '1 goal';
  return `${n} goals`;
}
