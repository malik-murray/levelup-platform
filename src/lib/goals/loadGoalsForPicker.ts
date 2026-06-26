import type { SupabaseClient } from '@supabase/supabase-js';
import type { HabitGoal } from './types';

export async function loadGoalsForPicker(
  client: SupabaseClient,
  userId: string
): Promise<Pick<HabitGoal, 'id' | 'name'>[]> {
  const { data, error } = await client
    .from('habit_goals')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .eq('is_completed', false)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('loadGoalsForPicker:', error);
    return [];
  }

  return data ?? [];
}
