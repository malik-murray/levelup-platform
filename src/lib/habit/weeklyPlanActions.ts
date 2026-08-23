import { supabase } from '@auth/supabaseClient';

export type WeeklyTodoItem = {
    id: string;
    title: string;
    sort_order: number;
    status: 'not_started' | 'in_progress' | 'done';
    assigned_date: string | null;
    item_day_id: string | null;
    todo_id: string | null;
    is_done: boolean;
};

export async function reorderWeeklyTodos(itemIds: string[]): Promise<void> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User must be authenticated to reorder weekly todos');

    for (let index = 0; index < itemIds.length; index++) {
        const { error } = await supabase
            .from('habit_weekly_items')
            .update({ sort_order: index })
            .eq('id', itemIds[index])
            .eq('user_id', user.id);

        if (error) {
            throw new Error(`Failed to reorder weekly todos: ${error.message}`);
        }
    }
}

export async function syncWeeklyTodoDayAssignment(
    userId: string,
    itemId: string,
    title: string,
    date: string | null,
    existingItemDayId?: string | null,
    existingTodoId?: string | null
): Promise<{ itemDayId: string | null; todoId: string | null }> {
    if (existingTodoId) {
        await supabase.from('habit_daily_todos').delete().eq('id', existingTodoId).eq('user_id', userId);
    }
    if (existingItemDayId) {
        await supabase.from('habit_weekly_item_days').delete().eq('id', existingItemDayId);
    }

    if (!date) {
        return { itemDayId: null, todoId: null };
    }

    const { data: itemDay, error: itemDayError } = await supabase
        .from('habit_weekly_item_days')
        .insert({
            weekly_item_id: itemId,
            date,
            completed: false,
        })
        .select('id')
        .single();

    if (itemDayError || !itemDay) {
        throw itemDayError ?? new Error('Failed to assign weekly todo to day');
    }

    const { data: newTodo, error: todoError } = await supabase
        .from('habit_daily_todos')
        .insert({
            user_id: userId,
            date,
            title: title.trim(),
            is_done: false,
            weekly_item_day_id: itemDay.id,
        })
        .select('id')
        .single();

    if (todoError || !newTodo) {
        await supabase.from('habit_weekly_item_days').delete().eq('id', itemDay.id);
        throw todoError ?? new Error('Failed to create linked daily todo');
    }

    await supabase.from('habit_weekly_item_days').update({ todo_id: newTodo.id }).eq('id', itemDay.id);

    return { itemDayId: itemDay.id, todoId: newTodo.id };
}

export async function deleteWeeklyTodoLinkedRecords(
    userId: string,
    todoId?: string | null,
    itemDayId?: string | null
): Promise<void> {
    if (todoId) {
        await supabase.from('habit_daily_todos').delete().eq('id', todoId).eq('user_id', userId);
    }
    if (itemDayId) {
        await supabase.from('habit_weekly_item_days').delete().eq('id', itemDayId);
    }
}
