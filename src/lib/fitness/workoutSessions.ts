import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkoutPlanWithItems } from './workoutPlans';
import { getPlansMuscleSlugs, getWorkoutPlanWithItems } from './workoutPlans';
import { getPrimaryMuscleSlugsByExerciseSlugs } from './exercises';
import { getFitnessUserProfileForUser } from './profile';
import { markProgramAssignmentCompletedForSession } from './programEngine';

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
        console.error('createSessionFromPlanDay (items insert):', itemsError);
        throw itemsError;
    }

    const sessionItems = (itemsData ?? []) as WorkoutSessionItem[];
    return { ...session, items: sessionItems };
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
    };
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

    const targets = plan.items.filter((i) => (i.day_index ?? 1) > sessionDay && i.sets > 2);
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
            .update({ sets: Math.max(2, item.sets - 1) })
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


