import { supabase } from '@auth/supabaseClient';
import type { EisenhowerFields } from '@/lib/habit/eisenhower';

export async function syncBacklogCompletion(backlogTaskId: string, completed: boolean) {
    const completedAt = completed ? new Date().toISOString() : null;
    const { error } = await supabase
        .from('habit_backlog_tasks')
        .update({ completed_at: completedAt })
        .eq('id', backlogTaskId);
    if (error) throw error;
}

export async function syncBacklogTitle(backlogTaskId: string, title: string) {
    const { error } = await supabase
        .from('habit_backlog_tasks')
        .update({ title })
        .eq('id', backlogTaskId);
    if (error) throw error;
}

export async function syncBacklogEisenhower(backlogTaskId: string, fields: EisenhowerFields) {
    const { error } = await supabase
        .from('habit_backlog_tasks')
        .update({
            is_important: fields.is_important,
            is_urgent: fields.is_urgent,
        })
        .eq('id', backlogTaskId);
    if (error) throw error;
}

export async function updatePriorityEisenhower(
    priorityId: string,
    userId: string,
    fields: EisenhowerFields,
    backlogTaskId?: string | null
) {
    const { error } = await supabase
        .from('habit_daily_priorities')
        .update({
            is_important: fields.is_important,
            is_urgent: fields.is_urgent,
        })
        .eq('id', priorityId)
        .eq('user_id', userId);
    if (error) throw error;
    if (backlogTaskId) {
        await syncBacklogEisenhower(backlogTaskId, fields);
    }
}

export async function updateTodoEisenhower(
    todoId: string,
    userId: string,
    fields: EisenhowerFields,
    backlogTaskId?: string | null
) {
    const { error } = await supabase
        .from('habit_daily_todos')
        .update({
            is_important: fields.is_important,
            is_urgent: fields.is_urgent,
        })
        .eq('id', todoId)
        .eq('user_id', userId);
    if (error) throw error;
    if (backlogTaskId) {
        await syncBacklogEisenhower(backlogTaskId, fields);
    }
}
