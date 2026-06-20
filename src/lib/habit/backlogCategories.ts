import type { SupabaseClient } from '@supabase/supabase-js';

export type BacklogCategory = {
    id: string;
    name: string;
};

export const DEFAULT_BACKLOG_CATEGORIES = [
    'Work',
    'Personal',
    'Financial',
    'Business',
    'Relationships',
] as const;

export async function loadBacklogCategories(
    supabase: SupabaseClient,
    userId: string
): Promise<BacklogCategory[]> {
    const { data, error } = await supabase
        .from('habit_backlog_categories')
        .select('id, name')
        .eq('user_id', userId)
        .order('name');

    if (error) throw error;
    if ((data ?? []).length > 0) return data;

    const { data: inserted, error: insertError } = await supabase
        .from('habit_backlog_categories')
        .insert(DEFAULT_BACKLOG_CATEGORIES.map((name) => ({ user_id: userId, name })))
        .select('id, name');

    if (insertError) throw insertError;
    return [...(inserted ?? [])].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadTodoCategoryIdsByTodoId(
    supabase: SupabaseClient,
    userId: string,
    todoIds: string[]
): Promise<Record<string, string[]>> {
    if (todoIds.length === 0) return {};

    const { data, error } = await supabase
        .from('habit_daily_todo_categories')
        .select('todo_id, category_id')
        .eq('user_id', userId)
        .in('todo_id', todoIds);

    if (error) throw error;

    const map: Record<string, string[]> = {};
    (data ?? []).forEach((row) => {
        if (!map[row.todo_id]) map[row.todo_id] = [];
        map[row.todo_id].push(row.category_id);
    });
    return map;
}

export function getCategoryNames(categories: BacklogCategory[], categoryIds: string[]): string[] {
    return categoryIds
        .map((id) => categories.find((category) => category.id === id)?.name)
        .filter(Boolean) as string[];
}
