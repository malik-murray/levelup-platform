import type { SupabaseClient } from '@supabase/supabase-js';

export type QuickCategoryAction = { id: string; name: string };

/** Up to 3 expense categories shown as notification action buttons (Android expanded tray). */
export async function getQuickCategoryActionsForPush(
    supabase: SupabaseClient,
    userId: string,
    suggestedCategoryId: string | null
): Promise<QuickCategoryAction[]> {
    const { data: cats } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('kind', 'category')
        .eq('type', 'expense')
        .eq('is_archived', false)
        .order('name');

    const all = (cats ?? []) as QuickCategoryAction[];
    const out: QuickCategoryAction[] = [];

    if (suggestedCategoryId) {
        const suggested = all.find(c => c.id === suggestedCategoryId);
        if (suggested) out.push(suggested);
    }

    for (const c of all) {
        if (out.length >= 3) break;
        if (c.id === suggestedCategoryId) continue;
        out.push(c);
    }

    return out.slice(0, 3);
}
