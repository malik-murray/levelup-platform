import type { SupabaseClient } from '@supabase/supabase-js';
import { loadHabitGoalIdsMap, syncGoalHabitLinks } from '@/lib/habit/habitTemplateLinks';

export type GoalHabitOption = {
  id: string;
  name: string;
  icon: string | null;
  linkedGoalIds: string[];
};

export async function loadHabitsForGoalForm(
  client: SupabaseClient,
  userId: string
): Promise<GoalHabitOption[]> {
  const { data: habits, error } = await client
    .from('habit_templates')
    .select('id, name, icon')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('loadHabitsForGoalForm:', error);
    return [];
  }

  const rows = habits ?? [];
  const goalIdsMap = await loadHabitGoalIdsMap(
    client,
    userId,
    rows.map((h) => h.id)
  );

  return rows.map((h) => ({
    id: h.id,
    name: h.name,
    icon: h.icon,
    linkedGoalIds: goalIdsMap[h.id] ?? [],
  }));
}

export async function syncGoalHabits(
  client: SupabaseClient,
  userId: string,
  goalId: string,
  linkedHabitIds: string[]
): Promise<void> {
  await syncGoalHabitLinks(client, userId, goalId, linkedHabitIds);
}
