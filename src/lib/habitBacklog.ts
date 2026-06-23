import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@auth/supabaseClient';
import type { EisenhowerFields } from '@/lib/habit/eisenhower';

type OrphanedBacklogTask = {
    id: string;
    title: string;
    assigned_date: string | null;
    is_important: boolean | null;
    is_urgent: boolean | null;
};

export async function repairOrphanedBacklogTasks(
    client: SupabaseClient,
    userId: string,
    tasks: OrphanedBacklogTask[]
) {
    if (tasks.length === 0) return;

    for (const task of tasks) {
        if (!task.assigned_date) continue;

        const { data: todo, error: insertError } = await client
            .from('habit_daily_todos')
            .insert({
                user_id: userId,
                title: task.title,
                date: task.assigned_date,
                is_done: false,
                is_important: task.is_important ?? false,
                is_urgent: task.is_urgent ?? false,
                backlog_task_id: task.id,
            })
            .select('id')
            .single();
        if (insertError) throw insertError;

        const { data: backlogTags, error: tagsError } = await client
            .from('habit_backlog_task_categories')
            .select('category_id')
            .eq('user_id', userId)
            .eq('backlog_task_id', task.id);
        if (tagsError) throw tagsError;

        const categoryIds = (backlogTags ?? []).map((row) => row.category_id);
        if (categoryIds.length > 0 && todo?.id) {
            const { error: linkError } = await client.from('habit_daily_todo_categories').insert(
                categoryIds.map((categoryId) => ({
                    user_id: userId,
                    todo_id: todo.id,
                    category_id: categoryId,
                }))
            );
            if (linkError) throw linkError;
        }
    }
}

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

export async function setBacklogTaskCategories(
    userId: string,
    backlogTaskId: string,
    categoryIds: string[]
) {
    await syncBacklogTaskCategories(userId, backlogTaskId, categoryIds);
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

export async function deleteBacklogTask(userId: string, backlogTaskId: string) {
    const { error } = await supabase
        .from('habit_backlog_tasks')
        .delete()
        .eq('id', backlogTaskId)
        .eq('user_id', userId);
    if (error) throw error;
}

export async function deleteBacklogTodo(
    userId: string,
    todoId: string,
    backlogTaskId?: string | null
) {
    const { error: todoError } = await supabase
        .from('habit_daily_todos')
        .delete()
        .eq('id', todoId)
        .eq('user_id', userId);
    if (todoError) throw todoError;

    if (backlogTaskId) {
        const { error: backlogError } = await supabase
            .from('habit_backlog_tasks')
            .delete()
            .eq('id', backlogTaskId)
            .eq('user_id', userId);
        if (backlogError) throw backlogError;
    }
}

export async function assignBacklogTodoToDate(
    userId: string,
    backlogTaskId: string,
    title: string,
    date: string,
    fields: EisenhowerFields,
    categoryIds: string[]
) {
    const { data: todo, error: insertError } = await supabase
        .from('habit_daily_todos')
        .insert({
            user_id: userId,
            title,
            date,
            is_done: false,
            is_important: fields.is_important ?? false,
            is_urgent: fields.is_urgent ?? false,
            backlog_task_id: backlogTaskId,
        })
        .select('id, title, is_done, date, created_at, is_important, is_urgent, backlog_task_id')
        .single();
    if (insertError) throw insertError;

    if (categoryIds.length > 0 && todo?.id) {
        await setTodoCategories(todo.id, userId, categoryIds, backlogTaskId);
    }

    return todo;
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
