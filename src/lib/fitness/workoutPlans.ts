import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ExerciseDifficulty } from './types';
import type { GeneratedWorkoutItem } from './workoutGenerator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient(provided?: SupabaseClient): SupabaseClient {
    if (provided) return provided;
    return createClient(supabaseUrl, supabaseAnonKey);
}

export type WorkoutPlan = {
    id: string;
    user_id: string | null;
    name: string;
    description: string | null;
    muscle_slugs: string[];
    difficulty: ExerciseDifficulty | null;
    is_template: boolean;
    created_at: string;
    updated_at: string;
};

export type WorkoutPlanItem = {
    id: string;
    plan_id: string;
    position: number;
    day_index: number;
    exercise_slug: string;
    sets: number;
    rep_range: string;
    rest_seconds: number;
    note: string | null;
    movement_pattern: string | null;
    mechanic: string | null;
    created_at: string;
};

export type WorkoutPlanWithItems = WorkoutPlan & {
    items: WorkoutPlanItem[];
};

export type CreateWorkoutPlanInput = {
    name: string;
    description?: string;
    muscleSlugs?: string[];
    difficulty?: ExerciseDifficulty;
    isTemplate?: boolean;
    items: GeneratedWorkoutItem[];
    /**
     * Required for user-owned plans. For templates, userId should be omitted
     * so user_id is NULL.
     */
    userId?: string;
    dayCount?: number;
};

export async function createWorkoutPlanFromGeneratedPlan(
    input: CreateWorkoutPlanInput,
    supabase?: SupabaseClient
): Promise<WorkoutPlanWithItems> {
    const client = getClient(supabase);
    const {
        name,
        description,
        muscleSlugs = [],
        difficulty,
        isTemplate = false,
        items,
        userId,
        dayCount = 1,
    } = input;

    const planPayload: Omit<WorkoutPlan, 'id' | 'created_at' | 'updated_at'> = {
        user_id: isTemplate ? null : userId ?? null,
        name,
        description: description ?? null,
        muscle_slugs: muscleSlugs,
        difficulty: difficulty ?? null,
        is_template: isTemplate,
    } as any;

    const { data: planData, error: planError } = await client
        .from('fitness_workout_plans')
        .insert(planPayload)
        .select('*')
        .single();

    if (planError) {
        console.error('createWorkoutPlanFromGeneratedPlan (plan insert):', planError);
        throw planError;
    }

    const plan = planData as WorkoutPlan;

    if (items.length === 0) {
        return { ...plan, items: [] };
    }

    const normalizedDayCount = Math.min(7, Math.max(1, dayCount));
    const itemPayloads = items.map((item, index) => ({
        plan_id: plan.id,
        position: index,
        day_index: (index % normalizedDayCount) + 1,
        exercise_slug: item.exercise.slug,
        sets: item.sets,
        rep_range: item.repRange,
        rest_seconds: item.restSeconds,
        note: item.note ?? null,
        movement_pattern: item.exercise.movement_pattern ?? null,
        mechanic: item.exercise.mechanic ?? null,
    }));

    const { data: itemsData, error: itemsError } = await client
        .from('fitness_workout_plan_items')
        .insert(itemPayloads)
        .select('*')
        .order('position', { ascending: true });

    if (itemsError) {
        console.error('createWorkoutPlanFromGeneratedPlan (items insert):', itemsError);
        throw itemsError;
    }

    const planItems = (itemsData ?? []) as WorkoutPlanItem[];

    return {
        ...plan,
        items: planItems,
    };
}

/**
 * Returns the plan name for a given plan id, or null if not found / no access.
 * Used for displaying source-plan context on session detail.
 */
export async function getWorkoutPlanName(
    planId: string,
    supabase?: SupabaseClient
): Promise<string | null> {
    if (!planId?.trim()) return null;
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_plans')
        .select('name')
        .eq('id', planId)
        .maybeSingle();

    if (error) {
        console.error('getWorkoutPlanName:', error);
        throw error;
    }
    return data?.name ?? null;
}

/**
 * Lightweight fetch of muscle_slugs for given plan IDs.
 * Used by train-next recommendation logic.
 */
export async function getPlansMuscleSlugs(
    planIds: string[],
    supabase?: SupabaseClient
): Promise<Record<string, string[]>> {
    if (planIds.length === 0) return {};
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_plans')
        .select('id, muscle_slugs')
        .in('id', planIds);

    if (error) {
        console.error('getPlansMuscleSlugs:', error);
        throw error;
    }

    const result: Record<string, string[]> = {};
    for (const row of data ?? []) {
        const r = row as { id: string; muscle_slugs: string[] };
        result[r.id] = r.muscle_slugs ?? [];
    }
    return result;
}

export async function getWorkoutPlanWithItems(
    planId: string,
    supabase?: SupabaseClient
): Promise<WorkoutPlanWithItems | null> {
    if (!planId?.trim()) return null;
    const client = getClient(supabase);

    const { data: planData, error: planError } = await client
        .from('fitness_workout_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

    if (planError) {
        console.error('getWorkoutPlanWithItems (plan):', planError);
        throw planError;
    }

    if (!planData) return null;

    const plan = planData as WorkoutPlan;

    const { data: itemsData, error: itemsError } = await client
        .from('fitness_workout_plan_items')
        .select('*')
        .eq('plan_id', plan.id)
        .order('position', { ascending: true });

    if (itemsError) {
        console.error('getWorkoutPlanWithItems (items):', itemsError);
        throw itemsError;
    }

    const items = (itemsData ?? []) as WorkoutPlanItem[];

    return {
        ...plan,
        items,
    };
}

export async function listWorkoutPlansForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<WorkoutPlan[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_plans')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('listWorkoutPlansForUser:', error);
        throw error;
    }

    return (data ?? []) as WorkoutPlan[];
}

export type WorkoutPlanWithItemCount = WorkoutPlan & { item_count: number };

export async function listWorkoutPlansForUserWithItemCounts(
    userId: string,
    supabase?: SupabaseClient
): Promise<WorkoutPlanWithItemCount[]> {
    const plans = await listWorkoutPlansForUser(userId, supabase);
    if (plans.length === 0) return [];

    const planIds = plans.map((p) => p.id);
    const client = getClient(supabase);
    const { data: itemRows, error: itemsError } = await client
        .from('fitness_workout_plan_items')
        .select('plan_id')
        .in('plan_id', planIds);

    if (itemsError) {
        console.error('listWorkoutPlansForUserWithItemCounts (items):', itemsError);
        throw itemsError;
    }

    const countByPlan: Record<string, number> = {};
    for (const row of itemRows ?? []) {
        const id = (row as { plan_id: string }).plan_id;
        countByPlan[id] = (countByPlan[id] ?? 0) + 1;
    }

    return plans.map((p) => ({
        ...p,
        item_count: countByPlan[p.id] ?? 0,
    }));
}

export async function listTemplateWorkoutPlans(
    supabase?: SupabaseClient
): Promise<WorkoutPlan[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_plans')
        .select('*')
        .is('user_id', null)
        .eq('is_template', true)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('listTemplateWorkoutPlans:', error);
        throw error;
    }

    return (data ?? []) as WorkoutPlan[];
}

/**
 * Reorders plan items by updating position for each item.
 * orderedItemIds: ids in the desired order (index = new position).
 * Uses two-phase update to avoid unique constraint violations on (plan_id, position).
 */
export async function reorderWorkoutPlanItems(
    planId: string,
    orderedItemIds: string[],
    supabase?: SupabaseClient
): Promise<void> {
    if (!planId?.trim() || orderedItemIds.length === 0) return;
    const client = getClient(supabase);
    const TEMP_OFFSET = 10000;

    for (let i = 0; i < orderedItemIds.length; i++) {
        const { error } = await client
            .from('fitness_workout_plan_items')
            .update({ position: TEMP_OFFSET + i })
            .eq('id', orderedItemIds[i])
            .eq('plan_id', planId);
        if (error) {
            console.error('reorderWorkoutPlanItems (phase 1):', error);
            throw error;
        }
    }
    for (let i = 0; i < orderedItemIds.length; i++) {
        const { error } = await client
            .from('fitness_workout_plan_items')
            .update({ position: i })
            .eq('id', orderedItemIds[i])
            .eq('plan_id', planId);
        if (error) {
            console.error('reorderWorkoutPlanItems (phase 2):', error);
            throw error;
        }
    }
    const { error: planErr } = await client
        .from('fitness_workout_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', planId);
    if (planErr) console.error('reorderWorkoutPlanItems (plan updated_at):', planErr);
}

/**
 * Appends a new exercise to a plan at the end.
 * Uses sensible defaults for sets, rep_range, rest_seconds if omitted.
 * Resolves movement_pattern and mechanic from the exercise catalog when available.
 */
export async function addWorkoutPlanItem(
    planId: string,
    input: {
        exerciseSlug: string;
        day_index?: number;
        sets?: number;
        rep_range?: string;
        rest_seconds?: number;
        note?: string | null;
    },
    supabase?: SupabaseClient
): Promise<WorkoutPlanItem> {
    const client = getClient(supabase);
    if (!planId?.trim() || !input.exerciseSlug?.trim()) {
        throw new Error('Plan id and exercise slug are required');
    }
    const plan = await getWorkoutPlanWithItems(planId, client);
    if (!plan) {
        throw new Error('Plan not found or you do not have access to it.');
    }
    const position = plan.items.length;
    const sets = input.sets ?? 3;
    const rep_range = (input.rep_range ?? '8–12').trim() || '8–12';
    const rest_seconds = input.rest_seconds ?? 60;
    if (sets < 1) throw new Error('Sets must be at least 1');
    if (rest_seconds < 0) throw new Error('Rest seconds cannot be negative');

    const { getExerciseBySlug } = await import('./exercises');
    const exercise = await getExerciseBySlug(input.exerciseSlug.trim(), client);

    const payload = {
        plan_id: planId,
        position,
        day_index: Math.min(7, Math.max(1, input.day_index ?? 1)),
        exercise_slug: input.exerciseSlug.trim(),
        sets,
        rep_range,
        rest_seconds,
        note: input.note ?? null,
        movement_pattern: exercise?.movement_pattern ?? null,
        mechanic: exercise?.mechanic ?? null,
    };

    const { data, error } = await client
        .from('fitness_workout_plan_items')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        console.error('addWorkoutPlanItem:', error);
        throw error;
    }

    await client
        .from('fitness_workout_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', planId);

    return data as WorkoutPlanItem;
}

/**
 * Updates editable fields on a plan item (sets, rep_range, rest_seconds).
 */
export async function updateWorkoutPlanItem(
    itemId: string,
    updates: { day_index?: number; sets?: number; rep_range?: string; rest_seconds?: number; note?: string | null },
    supabase?: SupabaseClient
): Promise<WorkoutPlanItem> {
    const client = getClient(supabase);
    if (updates.sets !== undefined && updates.sets < 1) {
        throw new Error('Sets must be at least 1');
    }
    if (updates.rest_seconds !== undefined && updates.rest_seconds < 0) {
        throw new Error('Rest seconds cannot be negative');
    }
    if (updates.rep_range !== undefined && !updates.rep_range.trim()) {
        throw new Error('Rep range is required');
    }
    const payload: Partial<WorkoutPlanItem> = {};
    if (updates.day_index !== undefined) {
        const dayIndex = Math.min(7, Math.max(1, updates.day_index));
        payload.day_index = dayIndex;
    }
    if (updates.sets !== undefined) payload.sets = updates.sets;
    if (updates.rep_range !== undefined) payload.rep_range = updates.rep_range.trim();
    if (updates.rest_seconds !== undefined) payload.rest_seconds = updates.rest_seconds;
    if ('note' in updates) payload.note = updates.note?.trim() || null;
    if (Object.keys(payload).length === 0) {
        const { data } = await client
            .from('fitness_workout_plan_items')
            .select('*')
            .eq('id', itemId)
            .single();
        return data as WorkoutPlanItem;
    }
    const { data, error } = await client
        .from('fitness_workout_plan_items')
        .update(payload)
        .eq('id', itemId)
        .select('*')
        .single();
    if (error) {
        console.error('updateWorkoutPlanItem:', error);
        throw error;
    }
    const updated = data as WorkoutPlanItem;
    await client
        .from('fitness_workout_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', updated.plan_id);
    return updated;
}

export async function updateWorkoutPlanItemExercise(
    itemId: string,
    exerciseSlug: string,
    supabase?: SupabaseClient
): Promise<WorkoutPlanItem> {
    const client = getClient(supabase);
    const trimmed = exerciseSlug.trim();
    if (!trimmed) throw new Error('Exercise slug is required');

    const { getExerciseBySlug } = await import('./exercises');
    const ex = await getExerciseBySlug(trimmed, client);
    if (!ex) throw new Error('Exercise not found');

    const { data, error } = await client
        .from('fitness_workout_plan_items')
        .update({
            exercise_slug: trimmed,
            movement_pattern: ex.movement_pattern ?? null,
            mechanic: ex.mechanic ?? null,
        })
        .eq('id', itemId)
        .select('*')
        .single();
    if (error) {
        console.error('updateWorkoutPlanItemExercise:', error);
        throw error;
    }
    const updated = data as WorkoutPlanItem;
    await client
        .from('fitness_workout_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', updated.plan_id);
    return updated;
}

export async function duplicateWorkoutPlanDay(
    planId: string,
    sourceDayIndex: number,
    supabase?: SupabaseClient
): Promise<WorkoutPlanItem[]> {
    const client = getClient(supabase);
    const plan = await getWorkoutPlanWithItems(planId, client);
    if (!plan) throw new Error('Plan not found or access denied');

    const src = plan.items.filter((i) => i.day_index === sourceDayIndex);
    if (src.length === 0) throw new Error('No items found for selected day');

    const maxDay = plan.items.reduce((m, i) => Math.max(m, i.day_index ?? 1), 1);
    const targetDay = Math.min(7, maxDay + 1);
    if (targetDay === sourceDayIndex) throw new Error('Cannot duplicate: target day unavailable');

    const maxPos = plan.items.reduce((m, i) => Math.max(m, i.position), -1);
    const payloads = src.map((item, idx) => ({
        plan_id: planId,
        position: maxPos + idx + 1,
        day_index: targetDay,
        exercise_slug: item.exercise_slug,
        sets: item.sets,
        rep_range: item.rep_range,
        rest_seconds: item.rest_seconds,
        note: item.note,
        movement_pattern: item.movement_pattern,
        mechanic: item.mechanic,
    }));

    const { data, error } = await client
        .from('fitness_workout_plan_items')
        .insert(payloads)
        .select('*')
        .order('position', { ascending: true });
    if (error) {
        console.error('duplicateWorkoutPlanDay:', error);
        throw error;
    }
    await client
        .from('fitness_workout_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', planId);
    return (data ?? []) as WorkoutPlanItem[];
}

/**
 * Removes a plan item and renormalizes positions so they remain contiguous (0..n-1).
 */
export async function removeWorkoutPlanItem(
    itemId: string,
    supabase?: SupabaseClient
): Promise<void> {
    const client = getClient(supabase);
    const { data: item, error: fetchErr } = await client
        .from('fitness_workout_plan_items')
        .select('plan_id, position')
        .eq('id', itemId)
        .maybeSingle();
    if (fetchErr) {
        console.error('removeWorkoutPlanItem (fetch):', fetchErr);
        throw fetchErr;
    }
    if (!item) return;
    const { plan_id, position } = item;
    const { error: deleteErr } = await client
        .from('fitness_workout_plan_items')
        .delete()
        .eq('id', itemId);
    if (deleteErr) {
        console.error('removeWorkoutPlanItem (delete):', deleteErr);
        throw deleteErr;
    }
    const { data: rest, error: listErr } = await client
        .from('fitness_workout_plan_items')
        .select('id, position')
        .eq('plan_id', plan_id)
        .gt('position', position)
        .order('position', { ascending: true });
    if (listErr) {
        console.error('removeWorkoutPlanItem (list):', listErr);
        throw listErr;
    }
    const toShift = (rest ?? []) as { id: string; position: number }[];
    if (toShift.length === 0) return;
    const TEMP_OFFSET = 10000;
    for (let i = 0; i < toShift.length; i++) {
        const { error } = await client
            .from('fitness_workout_plan_items')
            .update({ position: TEMP_OFFSET + i })
            .eq('id', toShift[i].id);
        if (error) throw error;
    }
    for (let i = 0; i < toShift.length; i++) {
        const { error } = await client
            .from('fitness_workout_plan_items')
            .update({ position: position + i })
            .eq('id', toShift[i].id);
        if (error) throw error;
    }
    await client
        .from('fitness_workout_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', plan_id);
}

export async function updateWorkoutPlanMeta(
    planId: string,
    updates: { name: string; description?: string | null },
    supabase?: SupabaseClient
): Promise<WorkoutPlan> {
    const client = getClient(supabase);
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
        throw new Error('Plan name is required');
    }

    const payload: Partial<WorkoutPlan> = {
        name: trimmedName,
        description: updates.description === undefined ? null : (updates.description?.trim() || null),
    };

    const { data, error } = await client
        .from('fitness_workout_plans')
        .update(payload)
        .eq('id', planId)
        .select('*')
        .single();

    if (error) {
        console.error('updateWorkoutPlanMeta:', error);
        throw error;
    }

    return data as WorkoutPlan;
}

/**
 * Duplicates a workout plan and all its items for the current user.
 * New plan name defaults to "{original name} Copy" unless overridden.
 * Duplicates are always user-owned (never templates).
 */
export async function duplicateWorkoutPlan(
    planId: string,
    options?: { name?: string },
    supabase?: SupabaseClient
): Promise<WorkoutPlanWithItems> {
    const client = getClient(supabase);
    if (!planId?.trim()) {
        throw new Error('Plan id is required');
    }

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
        throw new Error('You must be signed in to duplicate a plan');
    }

    const source = await getWorkoutPlanWithItems(planId, client);
    if (!source) {
        throw new Error('Plan not found or you do not have access to it');
    }

    const newName = (options?.name?.trim() || `${source.name} Copy`).trim();
    if (!newName) {
        throw new Error('Plan name is required');
    }

    const planPayload: Omit<WorkoutPlan, 'id' | 'created_at' | 'updated_at'> = {
        user_id: user.id,
        name: newName,
        description: source.description,
        muscle_slugs: source.muscle_slugs,
        difficulty: source.difficulty,
        is_template: false,
    } as WorkoutPlan;

    const { data: planData, error: planError } = await client
        .from('fitness_workout_plans')
        .insert(planPayload)
        .select('*')
        .single();

    if (planError) {
        console.error('duplicateWorkoutPlan (plan insert):', planError);
        throw planError;
    }

    const newPlan = planData as WorkoutPlan;

    if (source.items.length === 0) {
        return { ...newPlan, items: [] };
    }

    const itemPayloads = source.items.map((item, index) => ({
        plan_id: newPlan.id,
        position: index,
        exercise_slug: item.exercise_slug,
        sets: item.sets,
        rep_range: item.rep_range,
        rest_seconds: item.rest_seconds,
        note: item.note,
        movement_pattern: item.movement_pattern,
        mechanic: item.mechanic,
    }));

    const { data: itemsData, error: itemsError } = await client
        .from('fitness_workout_plan_items')
        .insert(itemPayloads)
        .select('*')
        .order('position', { ascending: true });

    if (itemsError) {
        console.error('duplicateWorkoutPlan (items insert):', itemsError);
        throw itemsError;
    }

    const planItems = (itemsData ?? []) as WorkoutPlanItem[];

    return {
        ...newPlan,
        items: planItems,
    };
}

export async function deleteWorkoutPlan(
    planId: string,
    supabase?: SupabaseClient
): Promise<void> {
    const client = getClient(supabase);
    const { error } = await client
        .from('fitness_workout_plans')
        .delete()
        .eq('id', planId);

    if (error) {
        console.error('deleteWorkoutPlan:', error);
        throw error;
    }
}


