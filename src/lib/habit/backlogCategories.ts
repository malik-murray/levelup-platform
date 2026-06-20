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

export function getCategoryName(
    categories: BacklogCategory[],
    categoryId: string | null | undefined
): string | null {
    if (!categoryId) return null;
    return categories.find((category) => category.id === categoryId)?.name ?? null;
}
