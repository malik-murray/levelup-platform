/**
 * Predefined habit templates for GRIT-style Templates modal.
 * Tabs: Good / Health / Bad / To-Do
 */

export type TemplateTab = 'good' | 'health' | 'bad' | 'todo';

export interface HabitTemplateOption {
  id: string;
  name: string;
  icon: string;
  tab: TemplateTab;
}

const good: HabitTemplateOption[] = [
  { id: 'g-1', name: 'Meditate', icon: '🧘', tab: 'good' },
  { id: 'g-2', name: 'Read', icon: '📖', tab: 'good' },
  { id: 'g-3', name: 'Exercise', icon: '💪', tab: 'good' },
  { id: 'g-4', name: 'Journal', icon: '📔', tab: 'good' },
  { id: 'g-5', name: 'Drink water', icon: '💧', tab: 'good' },
  { id: 'g-6', name: 'Sleep early', icon: '😴', tab: 'good' },
  { id: 'g-7', name: 'Gratitude', icon: '🙏', tab: 'good' },
  { id: 'g-8', name: 'Learn something', icon: '📚', tab: 'good' },
  { id: 'g-9', name: 'No phone morning', icon: '📵', tab: 'good' },
  { id: 'g-10', name: 'Stretch', icon: '🤸', tab: 'good' },
];

const health: HabitTemplateOption[] = [
  { id: 'h-1', name: 'Morning run', icon: '🏃', tab: 'health' },
  { id: 'h-2', name: 'Take vitamins', icon: '💊', tab: 'health' },
  { id: 'h-3', name: '8 glasses water', icon: '🥤', tab: 'health' },
  { id: 'h-4', name: 'No sugar', icon: '🚫', tab: 'health' },
  { id: 'h-5', name: '10k steps', icon: '👟', tab: 'health' },
  { id: 'h-6', name: 'Yoga', icon: '🧘‍♀️', tab: 'health' },
  { id: 'h-7', name: 'Meal prep', icon: '🥗', tab: 'health' },
  { id: 'h-8', name: 'Skincare', icon: '✨', tab: 'health' },
  { id: 'h-9', name: 'Sleep 7+ hours', icon: '🌙', tab: 'health' },
  { id: 'h-10', name: 'Walk after meal', icon: '🚶', tab: 'health' },
];

const bad: HabitTemplateOption[] = [
  { id: 'b-1', name: 'No smoking', icon: '🚭', tab: 'bad' },
  { id: 'b-2', name: 'No junk food', icon: '🍔', tab: 'bad' },
  { id: 'b-3', name: 'No late screen', icon: '📱', tab: 'bad' },
  { id: 'b-4', name: 'No alcohol', icon: '🍷', tab: 'bad' },
  { id: 'b-5', name: 'No snoozing', icon: '⏰', tab: 'bad' },
  { id: 'b-6', name: 'No caffeine after 2pm', icon: '☕', tab: 'bad' },
  { id: 'b-7', name: 'No complaining', icon: '😤', tab: 'bad' },
  { id: 'b-8', name: 'No impulse buy', icon: '🛒', tab: 'bad' },
  { id: 'b-9', name: 'No social media scroll', icon: '📲', tab: 'bad' },
  { id: 'b-10', name: 'No skipping breakfast', icon: '🍳', tab: 'bad' },
];

const todo: HabitTemplateOption[] = [
  { id: 't-1', name: 'Review goals', icon: '🎯', tab: 'todo' },
  { id: 't-2', name: 'Clear inbox', icon: '📧', tab: 'todo' },
  { id: 't-3', name: 'Plan tomorrow', icon: '📋', tab: 'todo' },
  { id: 't-4', name: 'Pay bills', icon: '💰', tab: 'todo' },
  { id: 't-5', name: 'Call family', icon: '📞', tab: 'todo' },
  { id: 't-6', name: 'Weekly review', icon: '📊', tab: 'todo' },
  { id: 't-7', name: 'Tidy desk', icon: '🧹', tab: 'todo' },
  { id: 't-8', name: 'Update budget', icon: '📈', tab: 'todo' },
  { id: 't-9', name: 'Schedule workouts', icon: '📅', tab: 'todo' },
  { id: 't-10', name: 'Backup files', icon: '💾', tab: 'todo' },
];

export const TEMPLATES_BY_TAB: Record<TemplateTab, HabitTemplateOption[]> = {
  good,
  health,
  bad,
  todo,
};

export const ALL_TEMPLATES: HabitTemplateOption[] = [
  ...good,
  ...health,
  ...bad,
  ...todo,
];

export function filterTemplates(
  tab: TemplateTab,
  search: string
): HabitTemplateOption[] {
  const list = TEMPLATES_BY_TAB[tab];
  if (!search.trim()) return list;
  const q = search.trim().toLowerCase();
  return list.filter(
    (t) =>
      t.name.toLowerCase().includes(q) || t.icon.includes(q)
  );
}
