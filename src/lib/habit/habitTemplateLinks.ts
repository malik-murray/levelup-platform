import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '@/lib/habitHelpers';

export const HABIT_TRACKER_CATEGORIES: Category[] = ['physical', 'mental', 'spiritual'];

export function habitMatchesCategory(
  template: { category: Category; categories?: Category[] },
  target: Category
): boolean {
  if (template.categories && template.categories.length > 0) {
    return template.categories.includes(target);
  }
  return template.category === target;
}

export async function enrichHabitTemplates<
  T extends { id: string; category: Category; goal_id?: string | null },
>(
  client: SupabaseClient,
  userId: string,
  templates: T[]
): Promise<(T & { categories: Category[]; goal_ids: string[] })[]> {
  if (templates.length === 0) return [];

  const ids = templates.map((t) => t.id);
  const [goalIdsMap, categoriesMap] = await Promise.all([
    loadHabitGoalIdsMap(client, userId, ids),
    loadHabitCategoriesMap(client, userId, ids),
  ]);

  return templates.map((t) => {
    const categories =
      categoriesMap[t.id]?.length ? categoriesMap[t.id] : [t.category];
    const goal_ids =
      goalIdsMap[t.id]?.length
        ? goalIdsMap[t.id]
        : t.goal_id
          ? [t.goal_id]
          : [];
    return { ...t, categories, goal_ids };
  });
}

export async function loadHabitGoalIdsMap(
  client: SupabaseClient,
  userId: string,
  habitTemplateIds: string[]
): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  if (habitTemplateIds.length === 0) return map;

  const { data, error } = await client
    .from('habit_template_goals')
    .select('habit_template_id, goal_id')
    .eq('user_id', userId)
    .in('habit_template_id', habitTemplateIds);

  if (error) {
    console.error('loadHabitGoalIdsMap:', error);
    return map;
  }

  for (const row of data ?? []) {
    if (!map[row.habit_template_id]) map[row.habit_template_id] = [];
    map[row.habit_template_id].push(row.goal_id);
  }
  return map;
}

export async function loadHabitCategoriesMap(
  client: SupabaseClient,
  userId: string,
  habitTemplateIds: string[]
): Promise<Record<string, Category[]>> {
  const map: Record<string, Category[]> = {};
  if (habitTemplateIds.length === 0) return map;

  const { data, error } = await client
    .from('habit_template_categories')
    .select('habit_template_id, category')
    .eq('user_id', userId)
    .in('habit_template_id', habitTemplateIds);

  if (error) {
    console.error('loadHabitCategoriesMap:', error);
    return map;
  }

  for (const row of data ?? []) {
    const cat = row.category as Category;
    if (!map[row.habit_template_id]) map[row.habit_template_id] = [];
    map[row.habit_template_id].push(cat);
  }
  return map;
}

export async function loadHabitTemplateLinks(
  client: SupabaseClient,
  userId: string,
  habitTemplateId: string
): Promise<{ goalIds: string[]; categories: Category[] }> {
  const [goalIdsMap, categoriesMap] = await Promise.all([
    loadHabitGoalIdsMap(client, userId, [habitTemplateId]),
    loadHabitCategoriesMap(client, userId, [habitTemplateId]),
  ]);
  return {
    goalIds: goalIdsMap[habitTemplateId] ?? [],
    categories: categoriesMap[habitTemplateId] ?? [],
  };
}

async function refreshHabitLegacyColumns(
  client: SupabaseClient,
  userId: string,
  habitTemplateIds: string[]
): Promise<void> {
  if (habitTemplateIds.length === 0) return;

  const [goalIdsMap, categoriesMap] = await Promise.all([
    loadHabitGoalIdsMap(client, userId, habitTemplateIds),
    loadHabitCategoriesMap(client, userId, habitTemplateIds),
  ]);

  const now = new Date().toISOString();
  await Promise.all(
    habitTemplateIds.map((habitId) => {
      const goalIds = goalIdsMap[habitId] ?? [];
      const categories = categoriesMap[habitId] ?? [];
      return client
        .from('habit_templates')
        .update({
          goal_id: goalIds[0] ?? null,
          category: categories[0] ?? 'mental',
          updated_at: now,
        })
        .eq('id', habitId)
        .eq('user_id', userId);
    })
  );
}

export async function syncHabitGoals(
  client: SupabaseClient,
  userId: string,
  habitTemplateId: string,
  goalIds: string[]
): Promise<void> {
  const { data: current, error } = await client
    .from('habit_template_goals')
    .select('goal_id')
    .eq('user_id', userId)
    .eq('habit_template_id', habitTemplateId);

  if (error) throw error;

  const currentIds = new Set((current ?? []).map((row) => row.goal_id));
  const nextIds = new Set(goalIds);
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  const toAdd = goalIds.filter((id) => !currentIds.has(id));

  if (toRemove.length > 0) {
    const { error: deleteError } = await client
      .from('habit_template_goals')
      .delete()
      .eq('user_id', userId)
      .eq('habit_template_id', habitTemplateId)
      .in('goal_id', toRemove);
    if (deleteError) throw deleteError;
  }

  if (toAdd.length > 0) {
    const { error: insertError } = await client.from('habit_template_goals').insert(
      toAdd.map((goalId) => ({
        user_id: userId,
        habit_template_id: habitTemplateId,
        goal_id: goalId,
      }))
    );
    if (insertError) throw insertError;
  }

  await refreshHabitLegacyColumns(client, userId, [habitTemplateId]);
}

export async function syncHabitCategories(
  client: SupabaseClient,
  userId: string,
  habitTemplateId: string,
  categories: Category[]
): Promise<void> {
  const unique = [...new Set(categories)];
  if (unique.length === 0) {
    throw new Error('At least one category is required');
  }

  const { data: current, error } = await client
    .from('habit_template_categories')
    .select('category')
    .eq('user_id', userId)
    .eq('habit_template_id', habitTemplateId);

  if (error) throw error;

  const currentCats = new Set((current ?? []).map((row) => row.category as Category));
  const nextCats = new Set(unique);
  const toRemove = [...currentCats].filter((c) => !nextCats.has(c));
  const toAdd = unique.filter((c) => !currentCats.has(c));

  if (toRemove.length > 0) {
    const { error: deleteError } = await client
      .from('habit_template_categories')
      .delete()
      .eq('user_id', userId)
      .eq('habit_template_id', habitTemplateId)
      .in('category', toRemove);
    if (deleteError) throw deleteError;
  }

  if (toAdd.length > 0) {
    const { error: insertError } = await client.from('habit_template_categories').insert(
      toAdd.map((category) => ({
        user_id: userId,
        habit_template_id: habitTemplateId,
        category,
      }))
    );
    if (insertError) throw insertError;
  }

  await refreshHabitLegacyColumns(client, userId, [habitTemplateId]);
}

export async function syncGoalHabitLinks(
  client: SupabaseClient,
  userId: string,
  goalId: string,
  linkedHabitIds: string[]
): Promise<void> {
  const { data: currentlyLinked, error } = await client
    .from('habit_template_goals')
    .select('habit_template_id')
    .eq('user_id', userId)
    .eq('goal_id', goalId);

  if (error) throw error;

  const currentHabitIds = new Set((currentlyLinked ?? []).map((row) => row.habit_template_id));
  const nextHabitIds = new Set(linkedHabitIds);
  const toUnlink = [...currentHabitIds].filter((id) => !nextHabitIds.has(id));
  const toLink = linkedHabitIds.filter((id) => !currentHabitIds.has(id));

  if (toUnlink.length > 0) {
    const { error: unlinkError } = await client
      .from('habit_template_goals')
      .delete()
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .in('habit_template_id', toUnlink);
    if (unlinkError) throw unlinkError;
  }

  if (toLink.length > 0) {
    const { error: linkError } = await client.from('habit_template_goals').insert(
      toLink.map((habitTemplateId) => ({
        user_id: userId,
        habit_template_id: habitTemplateId,
        goal_id: goalId,
      }))
    );
    if (linkError) throw linkError;
  }

  const affected = [...new Set([...toUnlink, ...toLink])];
  await refreshHabitLegacyColumns(client, userId, affected);
}
