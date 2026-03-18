import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkoutPlanWithItems } from './workoutPlans';
import { getWorkoutPlanWithItems } from './workoutPlans';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient(provided?: SupabaseClient): SupabaseClient {
    if (provided) return provided;
    return createClient(supabaseUrl, supabaseAnonKey);
}

export type WorkoutSession = {
    id: string;
    user_id: string;
    plan_id: string | null;
    started_at: string;
    ended_at: string | null;
    status: 'in_progress' | 'completed' | 'abandoned';
    name: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
};

export type WorkoutSessionItem = {
    id: string;
    session_id: string;
    plan_item_id: string | null;
    position: number;
    exercise_slug: string;
    target_sets: number;
    target_rep_range: string;
    target_rest_seconds: number;
    target_note: string | null;
    target_movement_pattern: string | null;
    target_mechanic: string | null;
    actual_sets_completed: number | null;
    actual_avg_reps_per_set: number | null;
    actual_notes: string | null;
    created_at: string;
    updated_at: string;
};

export type PreviousWorkoutPerformanceItem = WorkoutSessionItem & {
    session_started_at: string;
    session_ended_at: string | null;
};

export type WorkoutSessionWithItems = WorkoutSession & {
    items: WorkoutSessionItem[];
};

export async function createSessionFromPlan(
    planId: string,
    userId: string,
    supabase?: SupabaseClient
): Promise<WorkoutSessionWithItems> {
    const client = getClient(supabase);
    const plan: WorkoutPlanWithItems | null = await getWorkoutPlanWithItems(planId, client);

    if (!plan) {
        throw new Error('Plan not found or you do not have access to it.');
    }

    if (!plan.items || plan.items.length === 0) {
        throw new Error('Plan has no items to start a session from.');
    }

    // Create the session row
    const sessionPayload: Omit<WorkoutSession, 'id' | 'started_at' | 'ended_at' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        plan_id: plan.id,
        status: 'in_progress',
        name: plan.name,
        notes: null,
    } as any;

    const { data: sessionData, error: sessionError } = await client
        .from('fitness_workout_sessions')
        .insert(sessionPayload)
        .select('*')
        .single();

    if (sessionError) {
        console.error('createSessionFromPlan (session insert):', sessionError);
        throw sessionError;
    }

    const session = sessionData as WorkoutSession;

    // Create session items by copying plan items
    const itemPayloads = plan.items.map((item, index) => ({
        session_id: session.id,
        plan_item_id: item.id,
        position: index,
        exercise_slug: item.exercise_slug,
        target_sets: item.sets,
        target_rep_range: item.rep_range,
        target_rest_seconds: item.rest_seconds,
        target_note: item.note,
        target_movement_pattern: item.movement_pattern,
        target_mechanic: item.mechanic,
    }));

    const { data: itemsData, error: itemsError } = await client
        .from('fitness_workout_session_items')
        .insert(itemPayloads)
        .select('*')
        .order('position', { ascending: true });

    if (itemsError) {
        console.error('createSessionFromPlan (items insert):', itemsError);
        throw itemsError;
    }

    const sessionItems = (itemsData ?? []) as WorkoutSessionItem[];

    return {
        ...session,
        items: sessionItems,
    };
}

export async function getSessionWithItems(
    sessionId: string,
    supabase?: SupabaseClient
): Promise<WorkoutSessionWithItems | null> {
    const client = getClient(supabase);
    if (!sessionId?.trim()) return null;

    const { data: sessionData, error: sessionError } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

    if (sessionError) {
        console.error('getSessionWithItems (session):', sessionError);
        throw sessionError;
    }

    if (!sessionData) return null;

    const session = sessionData as WorkoutSession;

    const { data: itemsData, error: itemsError } = await client
        .from('fitness_workout_session_items')
        .select('*')
        .eq('session_id', session.id)
        .order('position', { ascending: true });

    if (itemsError) {
        console.error('getSessionWithItems (items):', itemsError);
        throw itemsError;
    }

    const items = (itemsData ?? []) as WorkoutSessionItem[];

    return {
        ...session,
        items,
    };
}

export async function listInProgressSessionsForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<WorkoutSession[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false });

    if (error) {
        console.error('listInProgressSessionsForUser:', error);
        throw error;
    }

    return (data ?? []) as WorkoutSession[];
}

export async function listRecentSessionsForUser(
    userId: string,
    supabase?: SupabaseClient,
    limit = 20
): Promise<WorkoutSession[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('listRecentSessionsForUser:', error);
        throw error;
    }

    return (data ?? []) as WorkoutSession[];
}

export async function updateWorkoutSessionItemActuals(
    sessionItemId: string,
    updates: {
        actual_sets?: number | null;
        actual_reps?: number | null;
        actual_weight?: number | null;
        actual_duration_minutes?: number | null;
        actual_distance?: number | null;
        actual_notes?: string | null;
    },
    supabase?: SupabaseClient
): Promise<WorkoutSessionItem> {
    const client = getClient(supabase);

    const { data: item, error: itemError } = await client
        .from('fitness_workout_session_items')
        .select('*')
        .eq('id', sessionItemId)
        .maybeSingle();

    if (itemError) {
        console.error('updateWorkoutSessionItemActuals (load item):', itemError);
        throw itemError;
    }
    if (!item) {
        throw new Error('Session item not found.');
    }

    const { data: session, error: sessionError } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('id', item.session_id)
        .maybeSingle();

    if (sessionError) {
        console.error('updateWorkoutSessionItemActuals (load session):', sessionError);
        throw sessionError;
    }
    if (!session) {
        throw new Error('Parent session not found.');
    }
    if (session.status !== 'in_progress') {
        throw new Error('Only in-progress sessions can be edited.');
    }

    const payload: Partial<WorkoutSessionItem> = {};
    if ('actual_sets' in updates) {
        payload.actual_sets_completed = updates.actual_sets ?? null;
    }
    if ('actual_reps' in updates) {
        payload.actual_avg_reps_per_set = updates.actual_reps ?? null;
    }
    if ('actual_notes' in updates) {
        payload.actual_notes = updates.actual_notes ?? null;
    }
    // actual_weight, actual_duration_minutes, actual_distance are currently not persisted;
    // schema would need to be extended in a future iteration.

    const { data, error } = await client
        .from('fitness_workout_session_items')
        .update(payload)
        .eq('id', sessionItemId)
        .select('*')
        .single();

    if (error) {
        console.error('updateWorkoutSessionItemActuals (update):', error);
        throw error;
    }

    return data as WorkoutSessionItem;
}

export async function getPreviousLoggedPerformanceForExercises(
    userId: string,
    currentSessionId: string,
    exerciseIds: string[],
    supabase?: SupabaseClient
): Promise<Record<string, PreviousWorkoutPerformanceItem | null>> {
    const client = getClient(supabase);

    if (!exerciseIds || exerciseIds.length === 0) {
        return {};
    }

    const uniqueExerciseSlugs = Array.from(new Set(exerciseIds));

    const { data, error } = await client
        .from('fitness_workout_session_items')
        .select(
            `
            *,
            fitness_workout_sessions (
                id,
                started_at,
                ended_at,
                user_id,
                status
            )
        `
        )
        .in('exercise_slug', uniqueExerciseSlugs)
        .neq('session_id', currentSessionId)
        .or(
            'actual_sets_completed.not.is.null,actual_avg_reps_per_set.not.is.null,actual_notes.neq.""'
        )
        .order('ended_at', {
            referencedTable: 'fitness_workout_sessions',
            ascending: false,
            nullsLast: true,
        })
        .order('started_at', {
            referencedTable: 'fitness_workout_sessions',
            ascending: false,
        });

    if (error) {
        console.error('getPreviousLoggedPerformanceForExercises:', error);
        throw error;
    }

    const result: Record<string, PreviousWorkoutPerformanceItem | null> = {};

    (data ?? []).forEach((row: any) => {
        const session = row.fitness_workout_sessions;
        if (!session) return;
        if (session.user_id !== userId) return;
        if (session.status !== 'completed') return;

        const slug = row.exercise_slug as string;
        if (result[slug]) {
            return;
        }

        const item: PreviousWorkoutPerformanceItem = {
            id: row.id,
            session_id: row.session_id,
            plan_item_id: row.plan_item_id,
            position: row.position,
            exercise_slug: row.exercise_slug,
            target_sets: row.target_sets,
            target_rep_range: row.target_rep_range,
            target_rest_seconds: row.target_rest_seconds,
            target_note: row.target_note,
            target_movement_pattern: row.target_movement_pattern,
            target_mechanic: row.target_mechanic,
            actual_sets_completed: row.actual_sets_completed,
            actual_avg_reps_per_set: row.actual_avg_reps_per_set,
            actual_notes: row.actual_notes,
            created_at: row.created_at,
            updated_at: row.updated_at,
            session_started_at: session.started_at,
            session_ended_at: session.ended_at,
        };

        result[slug] = item;
    });

    return result;
}



export async function completeWorkoutSession(
    sessionId: string,
    supabase?: SupabaseClient
): Promise<WorkoutSession> {
    const client = getClient(supabase);
    const { data: current, error: loadError } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

    if (loadError) {
        console.error('completeWorkoutSession (load):', loadError);
        throw loadError;
    }
    if (!current) {
        throw new Error('Session not found.');
    }
    if (current.status !== 'in_progress') {
        return current as WorkoutSession;
    }

    const { data, error } = await client
        .from('fitness_workout_sessions')
        .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select('*')
        .single();

    if (error) {
        console.error('completeWorkoutSession (update):', error);
        throw error;
    }

    return data as WorkoutSession;
}

export async function abandonWorkoutSession(
    sessionId: string,
    supabase?: SupabaseClient
): Promise<WorkoutSession> {
    const client = getClient(supabase);
    const { data: current, error: loadError } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

    if (loadError) {
        console.error('abandonWorkoutSession (load):', loadError);
        throw loadError;
    }
    if (!current) {
        throw new Error('Session not found.');
    }
    if (current.status !== 'in_progress') {
        return current as WorkoutSession;
    }

    const { data, error } = await client
        .from('fitness_workout_sessions')
        .update({
            status: 'abandoned',
            ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select('*')
        .single();

    if (error) {
        console.error('abandonWorkoutSession (update):', error);
        throw error;
    }

    return data as WorkoutSession;
}


