import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkedItem, LinkedItemType } from './types';

function pushItem(
  map: Record<string, LinkedItem[]>,
  goalId: string,
  item: LinkedItem
): void {
  if (!map[goalId]) map[goalId] = [];
  map[goalId].push(item);
}

export async function loadLinkedItemsByGoalId(
  supabase: SupabaseClient,
  userId: string,
  goalIds: string[]
): Promise<Record<string, LinkedItem[]>> {
  const result: Record<string, LinkedItem[]> = {};
  if (goalIds.length === 0) return result;

  const [
    habitsRes,
    habitGoalsRes,
    prioritiesRes,
    todosRes,
    backlogRes,
    weeklyRes,
  ] = await Promise.all([
    supabase
      .from('habit_templates')
      .select('id, name, goal_id, is_active')
      .eq('user_id', userId)
      .in('goal_id', goalIds),
    supabase
      .from('habit_template_goals')
      .select('goal_id, habit_template_id, habit_template:habit_templates(id, name, is_active)')
      .eq('user_id', userId)
      .in('goal_id', goalIds),
    supabase
      .from('habit_daily_priorities')
      .select('id, text, goal_id, completed, date')
      .eq('user_id', userId)
      .in('goal_id', goalIds)
      .order('date', { ascending: false })
      .limit(200),
    supabase
      .from('habit_daily_todos')
      .select('id, title, goal_id, is_done, date')
      .eq('user_id', userId)
      .in('goal_id', goalIds)
      .order('date', { ascending: false })
      .limit(200),
    supabase
      .from('habit_backlog_tasks')
      .select('id, title, goal_id, completed_at')
      .eq('user_id', userId)
      .in('goal_id', goalIds)
      .limit(200),
    supabase
      .from('habit_weekly_items')
      .select('id, title, goal_id, status')
      .eq('user_id', userId)
      .in('goal_id', goalIds)
      .limit(100),
  ]);

  const linkedHabitIds = new Set<string>();

  for (const row of habitsRes.data ?? []) {
    if (!row.goal_id) continue;
    if (linkedHabitIds.has(row.id)) continue;
    linkedHabitIds.add(row.id);
    pushItem(result, row.goal_id, {
      id: row.id,
      type: 'habit' as LinkedItemType,
      title: row.name,
      completed: !row.is_active,
    });
  }

  for (const row of habitGoalsRes.data ?? []) {
    if (!row.goal_id) continue;
    const habit = row.habit_template as
      | { id: string; name: string; is_active: boolean }
      | { id: string; name: string; is_active: boolean }[]
      | null;
    const template = habit == null ? null : Array.isArray(habit) ? habit[0] : habit;
    if (!template || linkedHabitIds.has(template.id)) continue;
    linkedHabitIds.add(template.id);
    pushItem(result, row.goal_id, {
      id: template.id,
      type: 'habit',
      title: template.name,
      completed: !template.is_active,
    });
  }

  for (const row of prioritiesRes.data ?? []) {
    if (!row.goal_id) continue;
    pushItem(result, row.goal_id, {
      id: row.id,
      type: 'priority',
      title: row.text,
      completed: Boolean(row.completed),
      date: row.date,
    });
  }

  for (const row of todosRes.data ?? []) {
    if (!row.goal_id) continue;
    pushItem(result, row.goal_id, {
      id: row.id,
      type: 'todo',
      title: row.title,
      completed: Boolean(row.is_done),
      date: row.date,
    });
  }

  for (const row of backlogRes.data ?? []) {
    if (!row.goal_id) continue;
    pushItem(result, row.goal_id, {
      id: row.id,
      type: 'backlog',
      title: row.title,
      completed: Boolean(row.completed_at),
    });
  }

  for (const row of weeklyRes.data ?? []) {
    if (!row.goal_id) continue;
    pushItem(result, row.goal_id, {
      id: row.id,
      type: 'weekly',
      title: row.title,
      completed: row.status === 'done',
    });
  }

  return result;
}

export const LINKED_ITEM_TYPE_LABELS: Record<LinkedItemType, string> = {
  habit: 'Habit',
  priority: 'Priority',
  todo: 'To-do',
  backlog: 'Backlog',
  weekly: 'Weekly plan',
};
