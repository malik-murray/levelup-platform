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

    const itemPayloads = items.map((item, index) => ({
        plan_id: plan.id,
        position: index,
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


