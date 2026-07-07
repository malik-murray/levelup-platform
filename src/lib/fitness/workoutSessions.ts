import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkoutPlanWithItems } from './workoutPlans';
import { getPlansMuscleSlugs, getWorkoutPlanWithItems } from './workoutPlans';
import { formatSlugAsTitle, getExerciseBySlug, getPrimaryMuscleSlugsByExerciseSlugs } from './exercises';
import { getFitnessUserProfileForUser } from './profile';
import { markProgramAssignmentCompletedForSession } from './programEngine';
import type { ExerciseCategory, ExerciseWithRelations } from './types';

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
    program_schedule_id?: string | null;
    /** Optional AI / demo full-session workout video */
    demo_video_url?: string | null;
    demo_thumbnail_url?: string | null;
    created_at: string;
    updated_at: string;
};

export type WorkoutSessionItem = {
    id: string;
    session_id: string;
    plan_item_id: string | null;
    position: number;
    exercise_slug: string;
    category: ExerciseCategory;
    target_sets: number | null;
    target_rep_range: string | null;
    target_rest_seconds: number | null;
    target_duration_seconds: number | null;
    target_rounds: number | null;
    cardio_type: string | null;
    target_note: string | null;
    target_movement_pattern: string | null;
    target_mechanic: string | null;
    actual_sets_completed: number | null;
    actual_avg_reps_per_set: number | null;
    actual_duration_seconds: number | null;
    actual_notes: string | null;
    created_at: string;
    updated_at: string;
};

export type WorkoutSetLog = {
    id: string;
    session_item_id: string;
    set_number: number;
    reps: number | null;
    weight_kg: number | null;
    rpe: number | null;
    duration_seconds: number | null;
    is_warmup: boolean;
    notes: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type WorkoutSessionItemWithSetLogs = WorkoutSessionItem & {
    set_logs: WorkoutSetLog[];
};

export type PreviousWorkoutPerformanceItem = WorkoutSessionItem & {
    session_started_at: string;
    session_ended_at: string | null;
};

export type WorkoutSessionWithItems = WorkoutSession & {
    items: WorkoutSessionItemWithSetLogs[];
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
        category: item.category,
        target_sets: item.sets,
        target_rep_range: item.rep_range,
        target_rest_seconds: item.rest_seconds,
        target_duration_seconds: item.target_duration_seconds,
        target_rounds: item.target_rounds,
        cardio_type: item.cardio_type,
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
        items: sessionItems.map((item) => ({ ...item, set_logs: [] })),
    };
}

export async function createSessionFromPlanDay(
    planId: string,
    dayIndex: number,
    userId: string,
    options?: { programScheduleId?: string | null },
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

    const targetDay = Math.min(7, Math.max(1, dayIndex));
    const dayItems = plan.items
        .filter((item) => (item.day_index ?? 1) === targetDay)
        .sort((a, b) => a.position - b.position);
    if (dayItems.length === 0) {
        throw new Error(`No workout items found for day ${targetDay} in this plan.`);
    }

    const sessionPayload: Omit<WorkoutSession, 'id' | 'started_at' | 'ended_at' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        plan_id: plan.id,
        status: 'in_progress',
        name: `${plan.name} • Day ${targetDay}`,
        notes: null,
        program_schedule_id: options?.programScheduleId ?? null,
    } as any;

    const { data: sessionData, error: sessionError } = await client
        .from('fitness_workout_sessions')
        .insert(sessionPayload)
        .select('*')
        .single();
    if (sessionError) {
        console.error('createSessionFromPlanDay (session insert):', sessionError);
        throw sessionError;
    }
    const session = sessionData as WorkoutSession;

    const itemPayloads = dayItems.map((item, index) => ({
        session_id: session.id,
        plan_item_id: item.id,
        position: index,
        exercise_slug: item.exercise_slug,
        category: item.category,
        target_sets: item.sets,
        target_rep_range: item.rep_range,
        target_rest_seconds: item.rest_seconds,
        target_duration_seconds: item.target_duration_seconds,
        target_rounds: item.target_rounds,
        cardio_type: item.cardio_type,
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
        console.error('createSessionFromPlanDay (items insert):', itemsError);
        throw itemsError;
    }

    const sessionItems = (itemsData ?? []) as WorkoutSessionItem[];
    return {
        ...session,
        items: sessionItems.map((item) => ({ ...item, set_logs: [] })),
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
    const setLogsByItem = await listSetLogsForSessionItemIds(
        items.map((item) => item.id),
        client
    );

    return {
        ...session,
        items: items.map((item) => ({
            ...item,
            set_logs: setLogsByItem[item.id] ?? [],
        })),
    };
}

async function listSetLogsForSessionItemIds(
    sessionItemIds: string[],
    client: SupabaseClient
): Promise<Record<string, WorkoutSetLog[]>> {
    if (sessionItemIds.length === 0) return {};

    const { data, error } = await client
        .from('fitness_workout_set_logs')
        .select('*')
        .in('session_item_id', sessionItemIds)
        .order('set_number', { ascending: true });

    if (error) {
        // Table may not exist until migration 082 is applied.
        if (error.code === 'PGRST205' || error.code === '42P01') {
            return {};
        }
        console.error('listSetLogsForSessionItemIds:', error);
        throw error;
    }

    const grouped: Record<string, WorkoutSetLog[]> = {};
    for (const row of data ?? []) {
        const log = row as WorkoutSetLog;
        if (!grouped[log.session_item_id]) grouped[log.session_item_id] = [];
        grouped[log.session_item_id].push(log);
    }
    return grouped;
}

function isSetLogCompleted(log: Pick<WorkoutSetLog, 'reps' | 'weight_kg' | 'completed_at'>): boolean {
    if (log.completed_at) return true;
    if (log.reps != null && log.reps > 0) return true;
    if (log.weight_kg != null && log.weight_kg > 0) return true;
    return false;
}

function computeRollupsFromSetLogs(
    logs: WorkoutSetLog[]
): Pick<WorkoutSessionItem, 'actual_sets_completed' | 'actual_avg_reps_per_set' | 'actual_duration_seconds'> {
    const completed = logs.filter(isSetLogCompleted);
    const repsValues = completed
        .map((log) => log.reps)
        .filter((reps): reps is number => reps != null && reps > 0);
    const durationValues = completed
        .map((log) => log.duration_seconds)
        .filter((duration): duration is number => duration != null && duration > 0);
    return {
        actual_sets_completed: completed.length > 0 ? completed.length : null,
        actual_avg_reps_per_set:
            repsValues.length > 0
                ? repsValues.reduce((sum, reps) => sum + reps, 0) / repsValues.length
                : null,
        actual_duration_seconds:
            durationValues.length > 0
                ? durationValues.reduce((sum, duration) => sum + duration, 0)
                : null,
    };
}

async function rollupSessionItemActualsFromSetLogs(
    sessionItemId: string,
    client: SupabaseClient
): Promise<WorkoutSessionItem> {
    const logsByItem = await listSetLogsForSessionItemIds([sessionItemId], client);
    const logs = logsByItem[sessionItemId] ?? [];
    const rollups = computeRollupsFromSetLogs(logs);

    const { data, error } = await client
        .from('fitness_workout_session_items')
        .update({
            actual_sets_completed: rollups.actual_sets_completed,
            actual_avg_reps_per_set: rollups.actual_avg_reps_per_set,
            actual_duration_seconds: rollups.actual_duration_seconds,
        })
        .eq('id', sessionItemId)
        .select('*')
        .single();

    if (error) {
        console.error('rollupSessionItemActualsFromSetLogs:', error);
        throw error;
    }

    return data as WorkoutSessionItem;
}

async function assertSessionItemEditable(
    sessionItemId: string,
    client: SupabaseClient
): Promise<WorkoutSessionItem> {
    const { data: item, error: itemError } = await client
        .from('fitness_workout_session_items')
        .select('*')
        .eq('id', sessionItemId)
        .maybeSingle();

    if (itemError) {
        console.error('assertSessionItemEditable (load item):', itemError);
        throw itemError;
    }
    if (!item) {
        throw new Error('Session item not found.');
    }

    const { data: session, error: sessionError } = await client
        .from('fitness_workout_sessions')
        .select('status')
        .eq('id', item.session_id)
        .maybeSingle();

    if (sessionError) {
        console.error('assertSessionItemEditable (load session):', sessionError);
        throw sessionError;
    }
    if (!session) {
        throw new Error('Parent session not found.');
    }
    if (session.status !== 'in_progress') {
        throw new Error('Only in-progress sessions can be edited.');
    }

    return item as WorkoutSessionItem;
}

export async function upsertSetLog(
    sessionItemId: string,
    setNumber: number,
    updates: {
        reps?: number | null;
        weight_kg?: number | null;
        rpe?: number | null;
        duration_seconds?: number | null;
        is_warmup?: boolean;
        notes?: string | null;
        completed_at?: string | null;
    },
    supabase?: SupabaseClient
): Promise<{ setLog: WorkoutSetLog; item: WorkoutSessionItemWithSetLogs }> {
    const client = getClient(supabase);
    if (!Number.isInteger(setNumber) || setNumber < 1) {
        throw new Error('Set number must be a positive integer.');
    }

    await assertSessionItemEditable(sessionItemId, client);

    const payload: Record<string, unknown> = {
        session_item_id: sessionItemId,
        set_number: setNumber,
    };
    if ('reps' in updates) payload.reps = updates.reps ?? null;
    if ('weight_kg' in updates) payload.weight_kg = updates.weight_kg ?? null;
    if ('rpe' in updates) payload.rpe = updates.rpe ?? null;
    if ('duration_seconds' in updates) payload.duration_seconds = updates.duration_seconds ?? null;
    if ('is_warmup' in updates) payload.is_warmup = updates.is_warmup ?? false;
    if ('notes' in updates) payload.notes = updates.notes ?? null;
    if ('completed_at' in updates) payload.completed_at = updates.completed_at ?? null;

    const { data: setLog, error } = await client
        .from('fitness_workout_set_logs')
        .upsert(payload, { onConflict: 'session_item_id,set_number' })
        .select('*')
        .single();

    if (error) {
        console.error('upsertSetLog:', error);
        throw error;
    }

    const item = await rollupSessionItemActualsFromSetLogs(sessionItemId, client);
    const logsByItem = await listSetLogsForSessionItemIds([sessionItemId], client);

    return {
        setLog: setLog as WorkoutSetLog,
        item: {
            ...item,
            set_logs: logsByItem[sessionItemId] ?? [],
        },
    };
}

export async function deleteSetLog(
    setLogId: string,
    supabase?: SupabaseClient
): Promise<WorkoutSessionItemWithSetLogs> {
    const client = getClient(supabase);

    const { data: existing, error: loadError } = await client
        .from('fitness_workout_set_logs')
        .select('*')
        .eq('id', setLogId)
        .maybeSingle();

    if (loadError) {
        console.error('deleteSetLog (load):', loadError);
        throw loadError;
    }
    if (!existing) {
        throw new Error('Set log not found.');
    }

    const sessionItemId = (existing as WorkoutSetLog).session_item_id;
    await assertSessionItemEditable(sessionItemId, client);

    const { error } = await client.from('fitness_workout_set_logs').delete().eq('id', setLogId);
    if (error) {
        console.error('deleteSetLog:', error);
        throw error;
    }

    const item = await rollupSessionItemActualsFromSetLogs(sessionItemId, client);
    const logsByItem = await listSetLogsForSessionItemIds([sessionItemId], client);
    return {
        ...item,
        set_logs: logsByItem[sessionItemId] ?? [],
    };
}

export type ExerciseHistoryEntry = {
    session_id: string;
    session_started_at: string;
    session_ended_at: string | null;
    actual_sets_completed: number | null;
    actual_avg_reps_per_set: number | null;
    actual_notes: string | null;
    target_note?: string | null;
};

/**
 * Returns completed session entries for an exercise, most recent first.
 * Authenticated user only; uses RLS.
 */
export async function getExerciseHistoryForUser(
    exerciseSlug: string,
    supabase?: SupabaseClient
): Promise<ExerciseHistoryEntry[]> {
    const client = getClient(supabase);
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }
    if (!exerciseSlug?.trim()) {
        return [];
    }

    const { data, error } = await client
        .from('fitness_workout_session_items')
        .select(
            `
            session_id,
            actual_sets_completed,
            actual_avg_reps_per_set,
            actual_notes,
            target_note,
            fitness_workout_sessions (
                id,
                started_at,
                ended_at,
                user_id,
                status
            )
        `
        )
        .eq('exercise_slug', exerciseSlug.trim())
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('getExerciseHistoryForUser:', error);
        throw error;
    }

    const result: ExerciseHistoryEntry[] = [];
    for (const row of data ?? []) {
        const session = (row as any).fitness_workout_sessions;
        if (!session || session.user_id !== user.id || session.status !== 'completed') continue;

        result.push({
            session_id: row.session_id,
            session_started_at: session.started_at,
            session_ended_at: session.ended_at,
            actual_sets_completed: row.actual_sets_completed,
            actual_avg_reps_per_set: row.actual_avg_reps_per_set,
            actual_notes: row.actual_notes,
            target_note: row.target_note,
        });
    }
    return result;
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

/**
 * Returns the user's in-progress sessions keyed by plan_id.
 * Only includes sessions with a non-null plan_id.
 * If multiple in-progress sessions exist for the same plan, uses the most recent.
 */
export async function getInProgressSessionsByPlanForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<Record<string, WorkoutSession>> {
    const sessions = await listInProgressSessionsForUser(userId, supabase);
    const byPlan: Record<string, WorkoutSession> = {};
    for (const s of sessions) {
        if (s.plan_id && !byPlan[s.plan_id]) {
            byPlan[s.plan_id] = s;
        }
    }
    return byPlan;
}

export type SessionSummary = {
    totalItems: number;
    loggedItems: number;
    totalSetsCompleted: number;
};

/**
 * Returns compact summaries for sessions (logged items, total sets).
 * An item counts as "logged" if it has actual_sets_completed, actual_avg_reps_per_set,
 * or non-empty actual_notes.
 */
export async function getSessionSummaries(
    sessionIds: string[],
    supabase?: SupabaseClient
): Promise<Record<string, SessionSummary>> {
    const client = getClient(supabase);
    if (!sessionIds || sessionIds.length === 0) return {};

    const { data, error } = await client
        .from('fitness_workout_session_items')
        .select('session_id, actual_sets_completed, actual_avg_reps_per_set, actual_notes')
        .in('session_id', sessionIds);

    if (error) {
        console.error('getSessionSummaries:', error);
        throw error;
    }

    const result: Record<string, SessionSummary> = {};
    for (const id of sessionIds) {
        result[id] = { totalItems: 0, loggedItems: 0, totalSetsCompleted: 0 };
    }

    for (const row of data ?? []) {
        const sid = (row as { session_id: string }).session_id;
        if (!result[sid]) continue;

        result[sid].totalItems += 1;
        const hasSets = row.actual_sets_completed != null;
        const hasReps = row.actual_avg_reps_per_set != null;
        const hasNotes = !!(row.actual_notes && String(row.actual_notes).trim());
        if (hasSets || hasReps || hasNotes) {
            result[sid].loggedItems += 1;
        }
        result[sid].totalSetsCompleted += row.actual_sets_completed ?? 0;
    }
    return result;
}

export type ProgressSummary = {
    completedSessionsCount: number;
    totalLoggedSets: number;
    latestCompletedSession: { id: string; name: string | null; ended_at: string | null } | null;
};

/**
 * Returns recent sessions with status = 'completed' only (excludes abandoned).
 */
export async function listCompletedSessionsForUser(
    userId: string,
    supabase?: SupabaseClient,
    limit = 100
): Promise<WorkoutSession[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('listCompletedSessionsForUser:', error);
        throw error;
    }
    return (data ?? []) as WorkoutSession[];
}

export type TrainingConsistency = {
    trainedToday: boolean;
    currentStreak: number;
    recentTrainingDates: string[];
};

/**
 * Derives simple training consistency from completed sessions.
 * Uses ended_at (fallback started_at) for date; collapses multiple sessions per day.
 * Streak: consecutive training days ending with today or yesterday.
 */
export async function getTrainingConsistencyForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<TrainingConsistency> {
    const sessions = await listCompletedSessionsForUser(userId, supabase, 60);
    const dateSet = new Set<string>();
    for (const s of sessions) {
        const ts = s.ended_at ?? s.started_at;
        const d = new Date(ts);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateSet.add(`${yyyy}-${mm}-${dd}`);
    }
    const recentTrainingDates = [...dateSet].sort().reverse();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const trainedToday = dateSet.has(todayStr);

    let currentStreak = 0;
    const anchor = trainedToday ? todayStr : dateSet.has(yesterdayStr) ? yesterdayStr : null;
    if (anchor) {
        let d = new Date(anchor + 'T12:00:00');
        while (true) {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!dateSet.has(key)) break;
            currentStreak++;
            d.setDate(d.getDate() - 1);
        }
    }

    return {
        trainedToday,
        currentStreak,
        recentTrainingDates,
    };
}

/** Upper-body muscle slugs for simple alternating recommendation logic. */
const UPPER_MUSCLES = new Set(['chest', 'upper-back', 'lats', 'shoulders', 'biceps', 'triceps', 'forearms']);

/** Lower-body muscle slugs. */
const LOWER_MUSCLES = new Set(['glutes', 'quads', 'hamstrings', 'calves']);

/** Core muscle slug. */
const CORE_SLUG = 'core';

export type TrainNextRecommendation = {
    recommendedMuscleSlug: string | null;
    recommendedLabel: string;
    reason: string;
    /** Optional context line, e.g. "Last lower-body: 3 days ago" */
    lastTrainedContext?: string;
};

function getSessionDate(session: WorkoutSession): string {
    return session.ended_at ?? session.started_at;
}

/** Latest ISO date string (lexicographic compare is valid for YYYY-MM-DD… timestamps). */
function laterIso(current: string | null, candidate: string): string {
    if (current == null || candidate > current) return candidate;
    return current;
}

function formatDaysAgo(isoDate: string): string {
    const then = new Date(isoDate).getTime();
    const now = Date.now();
    const days = Math.floor((now - then) / (24 * 60 * 60 * 1000));
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    return `${Math.floor(days / 7)} weeks ago`;
}

/**
 * Rule-based "what to train next" recommendation from recent completed sessions.
 * Uses plan muscle_slugs when available; for sessions without plan_id, infers muscles
 * from session items via exercise primary muscle. Factors in recency (last trained per
 * bucket: upper, lower, core). No AI, no fatigue modeling.
 */
export async function getTrainNextRecommendationForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<TrainNextRecommendation> {
    const sessions = await listCompletedSessionsForUser(userId, supabase, 25);
    if (sessions.length === 0) {
        return {
            recommendedMuscleSlug: null,
            recommendedLabel: '',
            reason: 'Start with a saved plan or generate a workout.',
        };
    }

    const client = getClient(supabase);

    // Build per-session muscles
    const sessionMuscles: Record<string, string[]> = {};
    const withPlan = sessions.filter((s) => s.plan_id);
    const withoutPlan = sessions.filter((s) => !s.plan_id);

    if (withPlan.length > 0) {
        const planIds = [...new Set(withPlan.map((s) => s.plan_id!).filter(Boolean))];
        const slugsByPlan = await getPlansMuscleSlugs(planIds, client);
        for (const s of withPlan) {
            sessionMuscles[s.id] = slugsByPlan[s.plan_id!] ?? [];
        }
    }

    if (withoutPlan.length > 0) {
        const sessionIds = withoutPlan.map((s) => s.id);
        const { data: items } = await client
            .from('fitness_workout_session_items')
            .select('session_id, exercise_slug')
            .in('session_id', sessionIds);

        const allExerciseSlugs = [...new Set((items ?? []).map((r: { exercise_slug: string }) => r.exercise_slug))];
        const slugToMuscle: Record<string, string> =
            allExerciseSlugs.length > 0
                ? await getPrimaryMuscleSlugsByExerciseSlugs(allExerciseSlugs, client)
                : {};

        for (const s of withoutPlan) {
            const sessionItems = (items ?? []).filter((r: { session_id: string }) => r.session_id === s.id);
            const muscles = [
                ...new Set(
                    sessionItems
                        .map((r: { exercise_slug: string }) => slugToMuscle[r.exercise_slug])
                        .filter((slug): slug is string => Boolean(slug))
                ),
            ];
            sessionMuscles[s.id] = muscles;
        }
    }

    // Track most recent training date per bucket (upper, lower, core)
    let lastUpper: string | null = null;
    let lastLower: string | null = null;
    let lastCore: string | null = null;

    for (const s of sessions) {
        const date = getSessionDate(s);
        const muscles = sessionMuscles[s.id] ?? [];
        for (const m of muscles) {
            if (UPPER_MUSCLES.has(m)) lastUpper = laterIso(lastUpper, date);
            if (LOWER_MUSCLES.has(m)) lastLower = laterIso(lastLower, date);
            if (m === CORE_SLUG) lastCore = laterIso(lastCore, date);
        }
    }

    const hasUpper = lastUpper != null;
    const hasLower = lastLower != null;

    if (!hasUpper && !hasLower) {
        const hasAnyMuscles = Object.values(sessionMuscles).some((arr) => arr.length > 0);
        if (hasAnyMuscles) {
            return {
                recommendedMuscleSlug: 'quads',
                recommendedLabel: 'Legs',
                reason: 'Legs are a solid next focus for strength and balance.',
            };
        }
        return {
            recommendedMuscleSlug: null,
            recommendedLabel: '',
            reason: 'Start with a saved plan or generate a workout.',
        };
    }

    if (hasUpper && !hasLower) {
        return {
            recommendedMuscleSlug: 'quads',
            recommendedLabel: 'Legs',
            reason: 'You trained upper body more recently, so legs are a good next focus.',
        };
    }
    if (hasLower && !hasUpper) {
        return {
            recommendedMuscleSlug: 'chest',
            recommendedLabel: 'Chest',
            reason: "It's been longer since your last upper-body session.",
        };
    }

    // Both upper and lower have been trained; use recency
    if (lastUpper! > lastLower!) {
        return {
            recommendedMuscleSlug: 'quads',
            recommendedLabel: 'Legs',
            reason: "It's been longer since your last lower-body session.",
            lastTrainedContext: `Last lower-body: ${formatDaysAgo(lastLower!)}`,
        };
    }
    if (lastLower! > lastUpper!) {
        return {
            recommendedMuscleSlug: 'chest',
            recommendedLabel: 'Chest',
            reason: "It's been longer since your last upper-body session.",
            lastTrainedContext: `Last upper-body: ${formatDaysAgo(lastUpper!)}`,
        };
    }

    return {
        recommendedMuscleSlug: 'core',
        recommendedLabel: 'Core',
        reason: "You've hit both upper and lower recently, so core is a solid next focus.",
    };
}

export type ProgressPageData = {
    summary: ProgressSummary;
    recentCompletedSessions: WorkoutSession[];
    weeklyAIRecap: string | null;
};

/**
 * Single fetch for progress summary + recent completed sessions (for /fitness/progress).
 * Uses up to 100 completed sessions for summary; recent list is first `recentLimit` of those.
 */
export async function getProgressPageDataForUser(
    userId: string,
    supabase?: SupabaseClient,
    recentLimit = 15
): Promise<ProgressPageData> {
    const sessions = await listCompletedSessionsForUser(userId, supabase, 100);
    if (sessions.length === 0) {
        return {
            summary: {
                completedSessionsCount: 0,
                totalLoggedSets: 0,
                latestCompletedSession: null,
            },
            recentCompletedSessions: [],
            weeklyAIRecap: null,
        };
    }
    const summaries = await getSessionSummaries(sessions.map((s) => s.id), supabase);
    const totalLoggedSets = Object.values(summaries).reduce(
        (sum, s) => sum + s.totalSetsCompleted,
        0
    );
    const latest = sessions[0];
    return {
        summary: {
            completedSessionsCount: sessions.length,
            totalLoggedSets,
            latestCompletedSession: {
                id: latest.id,
                name: latest.name,
                ended_at: latest.ended_at,
            },
        },
        recentCompletedSessions: sessions.slice(0, recentLimit),
        weeklyAIRecap: buildWeeklyAIRecap(sessions.length, totalLoggedSets),
    };
}

function buildWeeklyAIRecap(completedSessionsCount: number, totalLoggedSets: number): string {
    if (completedSessionsCount === 0) {
        return 'No sessions completed yet. Start with a short guided workout and build a baseline this week.';
    }
    if (completedSessionsCount < 3) {
        return `You completed ${completedSessionsCount} session(s). Keep momentum by scheduling one more focused workout this week.`;
    }
    if (totalLoggedSets < 40) {
        return `Consistency is improving. Next step: increase intent per set and log notes on effort to drive smarter progression.`;
    }
    return `Great consistency and workload this cycle. Next week, keep form quality high and progress either reps or load on your primary lifts.`;
}

/**
 * Returns compact progress stats from completed sessions only.
 * Uses recent completed sessions (limit 100) for aggregation; lightweight and bounded.
 */
export async function getProgressSummaryForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<ProgressSummary> {
    const { summary } = await getProgressPageDataForUser(userId, supabase, 0);
    return summary;
}

/**
 * Sessions for the fitness home video grid (excludes abandoned). Newest first.
 */
export async function listSessionsForHomeFeed(
    userId: string,
    supabase?: SupabaseClient,
    limit = 48
): Promise<WorkoutSession[]> {
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'abandoned')
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('listSessionsForHomeFeed:', error);
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
            foreignTable: 'fitness_workout_sessions',
            ascending: false,
        })
        .order('started_at', {
            foreignTable: 'fitness_workout_sessions',
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
            category: row.category,
            target_sets: row.target_sets,
            target_rep_range: row.target_rep_range,
            target_rest_seconds: row.target_rest_seconds,
            target_duration_seconds: row.target_duration_seconds,
            target_rounds: row.target_rounds,
            cardio_type: row.cardio_type,
            target_note: row.target_note,
            target_movement_pattern: row.target_movement_pattern,
            target_mechanic: row.target_mechanic,
            actual_sets_completed: row.actual_sets_completed,
            actual_avg_reps_per_set: row.actual_avg_reps_per_set,
            actual_duration_seconds: row.actual_duration_seconds,
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
): Promise<CompleteWorkoutSessionResult> {
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
        return { session: current as WorkoutSession, adaptation: null };
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

    const session = data as WorkoutSession;
    let adaptation: SessionAdaptiveUpdate | null = null;
    try {
        adaptation = await applyAdaptiveUpdateAfterCompletion(session.id, client);
    } catch (e) {
        console.error('completeWorkoutSession (adaptive update):', e);
        adaptation = null;
    }
    try {
        await markProgramAssignmentCompletedForSession({
            userId: session.user_id,
            planId: session.plan_id,
            sessionId: session.id,
            sessionEndedAt: session.ended_at ?? new Date().toISOString(),
            programScheduleId: session.program_schedule_id ?? null,
            supabase: client,
        });
    } catch (e) {
        console.error('completeWorkoutSession (program schedule completion):', e);
    }
    try {
        await client.from('fitness_ai_coaching_events').insert({
            user_id: session.user_id,
            session_id: session.id,
            prompt_type: 'session_finish',
            response_id: `session-${session.id}`,
            response_text: adaptation?.reason ?? 'Session completed and logged.',
        });
    } catch (e) {
        console.error('completeWorkoutSession (coaching event log):', e);
    }

    return { session, adaptation };
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

export type SessionAdaptiveUpdate = {
    applied: boolean;
    reason: string;
    suggestions: string[];
};

export type CompleteWorkoutSessionResult = {
    session: WorkoutSession;
    adaptation: SessionAdaptiveUpdate | null;
};

export type ExecutionAdaptiveInsights = {
    expectedDaysPerWeek: number;
    completedDaysThisWeek: number;
    missedDaysThisWeek: number;
    recentAverageCompletionRate: number;
    suggestions: string[];
};

function getDateKeyLocal(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function applyAdaptiveUpdateAfterCompletion(
    sessionId: string,
    supabase?: SupabaseClient
): Promise<SessionAdaptiveUpdate | null> {
    const client = getClient(supabase);
    const { data: sessionData, error: sErr } = await client
        .from('fitness_workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();
    if (sErr || !sessionData) return null;
    const session = sessionData as WorkoutSession;
    if (!session.plan_id) {
        return {
            applied: false,
            reason: 'No linked plan for this session.',
            suggestions: ['Use a saved plan to enable automatic adaptive updates.'],
        };
    }

    const summaries = await getSessionSummaries([session.id], client);
    const summary = summaries[session.id];
    const completionRate =
        !summary || summary.totalItems === 0
            ? 0
            : Math.round((summary.loggedItems / summary.totalItems) * 100);
    const insights = await getExecutionAdaptiveInsightsForUser(session.user_id, client);
    const shouldDeload = completionRate < 50 || insights.missedDaysThisWeek >= 2;

    if (!shouldDeload) {
        return {
            applied: false,
            reason: 'Completion and adherence look on track.',
            suggestions: ['Keep current volume next week.', ...insights.suggestions.slice(0, 1)],
        };
    }

    const plan = await getWorkoutPlanWithItems(session.plan_id, client);
    if (!plan || plan.items.length === 0) {
        return {
            applied: false,
            reason: 'No plan items found to adjust.',
            suggestions: insights.suggestions,
        };
    }

    // Determine current training day from linked plan items in this completed session.
    const { data: sessItems } = await client
        .from('fitness_workout_session_items')
        .select('plan_item_id')
        .eq('session_id', session.id);
    const sessionPlanItemIds = new Set((sessItems ?? []).map((r: { plan_item_id: string | null }) => r.plan_item_id).filter(Boolean) as string[]);
    const sessionDay = plan.items
        .filter((i) => sessionPlanItemIds.has(i.id))
        .reduce((m, i) => Math.max(m, i.day_index ?? 1), 1);

    const targets = plan.items.filter((i) => (i.day_index ?? 1) > sessionDay && (i.sets ?? 0) > 2);
    if (targets.length === 0) {
        return {
            applied: false,
            reason: 'No upcoming higher-volume items to reduce.',
            suggestions: insights.suggestions,
        };
    }

    for (const item of targets) {
        await client
            .from('fitness_workout_plan_items')
            .update({ sets: Math.max(2, (item.sets ?? 3) - 1) })
            .eq('id', item.id);
    }
    await client
        .from('fitness_workout_plans')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', plan.id);

    return {
        applied: true,
        reason: `Reduced sets by 1 (min 2) for ${targets.length} upcoming plan item(s).`,
        suggestions: insights.suggestions,
    };
}

export async function getExecutionAdaptiveInsightsForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<ExecutionAdaptiveInsights> {
    const client = getClient(supabase);
    const profile = await getFitnessUserProfileForUser(userId, client);
    const expectedDaysPerWeek = profile?.days_per_week ?? 3;

    const sessions = await listCompletedSessionsForUser(userId, client, 40);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    const weekStartMs = weekStart.getTime();

    const datesThisWeek = new Set<string>();
    const recentSessionIds: string[] = [];
    for (const s of sessions) {
        const ts = s.ended_at ?? s.started_at;
        const ms = new Date(ts).getTime();
        if (ms >= weekStartMs) {
            datesThisWeek.add(getDateKeyLocal(ts));
        }
        recentSessionIds.push(s.id);
    }
    const completedDaysThisWeek = datesThisWeek.size;
    const missedDaysThisWeek = Math.max(0, expectedDaysPerWeek - completedDaysThisWeek);

    const summaryMap = await getSessionSummaries(recentSessionIds.slice(0, 10), client);
    const rates = Object.values(summaryMap)
        .filter((s) => s.totalItems > 0)
        .map((s) => Math.round((s.loggedItems / s.totalItems) * 100));
    const recentAverageCompletionRate =
        rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;

    const suggestions: string[] = [];
    if (missedDaysThisWeek >= 2) {
        suggestions.push('Missed days detected: prioritize shorter sessions and core compounds this week.');
    }
    if (recentAverageCompletionRate < 50) {
        suggestions.push('Low completion rate: reduce per-exercise sets by 1 and keep sessions <=45 minutes.');
    } else if (recentAverageCompletionRate < 75) {
        suggestions.push('Moderate completion: keep exercise count steady and avoid adding volume this week.');
    } else {
        suggestions.push('Adherence is strong: keep current plan and progress gradually.');
    }
    suggestions.push('If sore, swap to lower-impact alternatives in the same muscle group.');

    return {
        expectedDaysPerWeek,
        completedDaysThisWeek,
        missedDaysThisWeek,
        recentAverageCompletionRate,
        suggestions,
    };
}

// =============================================================================
// Quick log (unified strength/cardio/stretch ad-hoc logging)
// =============================================================================

export type QuickLogEntry =
    | {
          category: 'strength';
          exerciseSlug: string;
          sets: Array<{ reps?: number | null; weight_kg?: number | null; rpe?: number | null }>;
          notes?: string | null;
      }
    | {
          category: 'cardio';
          cardioType: string;
          durationMinutes: number;
          notes?: string | null;
      }
    | {
          category: 'stretch';
          exerciseSlug: string;
          holdSeconds: number;
          rounds: number;
          notes?: string | null;
      };

function quickLogSessionName(entry: QuickLogEntry, exerciseName: string | null): string {
    if (entry.category === 'cardio') {
        return `Quick log: ${exerciseName ?? entry.cardioType}`;
    }
    return `Quick log: ${exerciseName ?? formatSlugAsTitle(entry.exerciseSlug)}`;
}

/**
 * Creates a one-off, immediately-completed session for ad-hoc logging (strength, cardio,
 * or stretch) so it counts toward streaks/progress like any plan-driven session.
 * Replaces the old standalone `fitness_workouts` quick logger.
 */
export async function createQuickLogSession(
    userId: string,
    entry: QuickLogEntry,
    supabase?: SupabaseClient
): Promise<WorkoutSessionWithItems> {
    const client = getClient(supabase);

    let exercise: ExerciseWithRelations | null = null;
    if (entry.category === 'cardio') {
        exercise = await getExerciseBySlug(entry.cardioType, client);
    } else {
        exercise = await getExerciseBySlug(entry.exerciseSlug, client);
        if (!exercise) {
            throw new Error('Exercise not found.');
        }
    }

    const sessionPayload: Omit<WorkoutSession, 'id' | 'started_at' | 'ended_at' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        plan_id: null,
        status: 'in_progress',
        name: quickLogSessionName(entry, exercise?.name ?? null),
        notes: null,
    } as any;

    const { data: sessionData, error: sessionError } = await client
        .from('fitness_workout_sessions')
        .insert(sessionPayload)
        .select('*')
        .single();
    if (sessionError) {
        console.error('createQuickLogSession (session insert):', sessionError);
        throw sessionError;
    }
    const session = sessionData as WorkoutSession;

    const itemPayload =
        entry.category === 'strength'
            ? {
                  session_id: session.id,
                  plan_item_id: null,
                  position: 0,
                  exercise_slug: entry.exerciseSlug,
                  category: 'strength',
                  target_sets: Math.max(1, entry.sets.length),
                  target_rep_range: '—',
                  target_rest_seconds: 60,
                  target_note: entry.notes ?? null,
                  target_movement_pattern: exercise?.movement_pattern ?? null,
                  target_mechanic: exercise?.mechanic ?? null,
              }
            : entry.category === 'cardio'
              ? {
                    session_id: session.id,
                    plan_item_id: null,
                    position: 0,
                    exercise_slug: exercise?.slug ?? entry.cardioType,
                    category: 'cardio',
                    target_duration_seconds: Math.max(1, Math.round(entry.durationMinutes * 60)),
                    cardio_type: entry.cardioType,
                    target_note: entry.notes ?? null,
                }
              : {
                    session_id: session.id,
                    plan_item_id: null,
                    position: 0,
                    exercise_slug: entry.exerciseSlug,
                    category: 'stretch',
                    target_duration_seconds: Math.max(1, Math.round(entry.holdSeconds)),
                    target_rounds: Math.max(1, entry.rounds),
                    target_note: entry.notes ?? null,
                };

    const { data: itemData, error: itemError } = await client
        .from('fitness_workout_session_items')
        .insert(itemPayload)
        .select('*')
        .single();
    if (itemError) {
        console.error('createQuickLogSession (item insert):', itemError);
        throw itemError;
    }
    const item = itemData as WorkoutSessionItem;

    if (entry.category === 'strength') {
        let setNumber = 1;
        for (const set of entry.sets.length > 0 ? entry.sets : [{}]) {
            await upsertSetLog(
                item.id,
                setNumber,
                {
                    reps: set.reps ?? null,
                    weight_kg: set.weight_kg ?? null,
                    rpe: set.rpe ?? null,
                    notes: entry.notes ?? null,
                    completed_at: new Date().toISOString(),
                },
                client
            );
            setNumber += 1;
        }
    } else if (entry.category === 'cardio') {
        await upsertSetLog(
            item.id,
            1,
            {
                duration_seconds: Math.max(1, Math.round(entry.durationMinutes * 60)),
                notes: entry.notes ?? null,
                completed_at: new Date().toISOString(),
            },
            client
        );
    } else {
        for (let round = 1; round <= Math.max(1, entry.rounds); round++) {
            await upsertSetLog(
                item.id,
                round,
                {
                    duration_seconds: Math.max(1, Math.round(entry.holdSeconds)),
                    notes: entry.notes ?? null,
                    completed_at: new Date().toISOString(),
                },
                client
            );
        }
    }

    await completeWorkoutSession(session.id, client);

    const result = await getSessionWithItems(session.id, client);
    if (!result) {
        throw new Error('Quick log session was created but could not be reloaded.');
    }
    return result;
}

export type WeeklyCategoryBreakdown = {
    strengthSetsThisWeek: number;
    cardioMinutesThisWeek: number;
    stretchSessionsThisWeek: number;
};

/**
 * Aggregates completed-session activity from the last 7 days, broken down by exercise
 * category, for the progress page's strength/cardio/stretch stat tiles.
 */
export async function getWeeklyCategoryBreakdownForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<WeeklyCategoryBreakdown> {
    const client = getClient(supabase);
    const sessions = await listCompletedSessionsForUser(userId, client, 100);

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentSessionIds = sessions
        .filter((s) => new Date(s.ended_at ?? s.started_at).getTime() >= weekAgo)
        .map((s) => s.id);

    if (recentSessionIds.length === 0) {
        return { strengthSetsThisWeek: 0, cardioMinutesThisWeek: 0, stretchSessionsThisWeek: 0 };
    }

    const { data, error } = await client
        .from('fitness_workout_session_items')
        .select('session_id, category, actual_sets_completed, actual_duration_seconds')
        .in('session_id', recentSessionIds);

    if (error) {
        console.error('getWeeklyCategoryBreakdownForUser:', error);
        throw error;
    }

    const rows = (data ?? []) as {
        session_id: string;
        category: string;
        actual_sets_completed: number | null;
        actual_duration_seconds: number | null;
    }[];

    let strengthSetsThisWeek = 0;
    let cardioSecondsThisWeek = 0;
    const stretchSessionIds = new Set<string>();

    for (const row of rows) {
        if (row.category === 'strength') {
            strengthSetsThisWeek += row.actual_sets_completed ?? 0;
        } else if (row.category === 'cardio') {
            cardioSecondsThisWeek += row.actual_duration_seconds ?? 0;
        } else if (row.category === 'stretch' && row.actual_duration_seconds != null) {
            stretchSessionIds.add(row.session_id);
        }
    }

    return {
        strengthSetsThisWeek,
        cardioMinutesThisWeek: Math.round(cardioSecondsThisWeek / 60),
        stretchSessionsThisWeek: stretchSessionIds.size,
    };
}


