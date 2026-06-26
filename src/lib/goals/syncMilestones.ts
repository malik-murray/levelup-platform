import type { SupabaseClient } from '@supabase/supabase-js';
import type { MilestoneDraft } from './types';

export async function syncGoalMilestones(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  milestones: MilestoneDraft[],
  removedIds: string[]
): Promise<void> {
  if (removedIds.length > 0) {
    await supabase.from('habit_milestones').delete().in('id', removedIds).eq('user_id', userId);
  }

  const now = new Date().toISOString();

  for (const m of milestones) {
    const name = m.name.trim();
    if (!name) continue;

    const target = m.target_value ? Number(m.target_value) : null;
    const payload = {
      user_id: userId,
      goal_id: goalId,
      name,
      description: m.description.trim() || null,
      due_date: m.due_date || null,
      values: target != null && Number.isFinite(target) ? [target] : [],
      updated_at: now,
    };

    if (m.id) {
      await supabase
        .from('habit_milestones')
        .update({ ...payload, is_completed: m.is_completed })
        .eq('id', m.id)
        .eq('user_id', userId);
    } else {
      await supabase.from('habit_milestones').insert({
        ...payload,
        current_value: 0,
        is_completed: false,
        is_archived: false,
      });
    }
  }
}
