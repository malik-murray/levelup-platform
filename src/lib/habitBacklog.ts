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

async function syncBacklogTaskCategories(
    userId: string,
    backlogTaskId: string,
    categoryIds: string[]
) {
    const { error: deleteError } = await supabase
        .from('habit_backlog_task_categories')
        .delete()
        .eq('user_id', userId)
        .eq('backlog_task_id', backlogTaskId);
    if (deleteError) throw deleteError;

    if (categoryIds.length === 0) return;

    const { error: insertError } = await supabase.from('habit_backlog_task_categories').insert(
        categoryIds.map((categoryId) => ({
            user_id: userId,
            backlog_task_id: backlogTaskId,
            category_id: categoryId,
        }))
    );
    if (insertError) throw insertError;
}

export async function setTodoCategories(
    todoId: string,
    userId: string,
    categoryIds: string[],
    backlogTaskId?: string | null
) {
    const { error: deleteError } = await supabase
        .from('habit_daily_todo_categories')
        .delete()
        .eq('user_id', userId)
        .eq('todo_id', todoId);
    if (deleteError) throw deleteError;

    if (categoryIds.length > 0) {
        const { error: insertError } = await supabase.from('habit_daily_todo_categories').insert(
            categoryIds.map((categoryId) => ({
                user_id: userId,
                todo_id: todoId,
                category_id: categoryId,
            }))
        );
        if (insertError) throw insertError;
    }

    if (backlogTaskId) {
        await syncBacklogTaskCategories(userId, backlogTaskId, categoryIds);
    }
}
