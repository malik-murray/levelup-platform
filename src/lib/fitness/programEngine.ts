import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FitnessTrainingLevel } from './profile';
import { getWorkoutPlanWithItems } from './workoutPlans';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getClient(provided?: SupabaseClient): SupabaseClient {
    if (provided) return provided;
    return createClient(supabaseUrl, supabaseAnonKey);
}

export type ActiveProgram = {
    id: string;
    user_id: string;
    plan_id: string;
    status: 'active' | 'paused';
    progression_mode: 'conservative' | 'aggressive';
    start_date: string;
    training_weekdays: number[];
    created_at: string;
    updated_at: string;
};

export type ProgramScheduleEntry = {
    id: string;
    active_program_id: string;
    scheduled_date: string;
    day_index: number;
    status: 'scheduled' | 'missed' | 'completed';
    session_id: string | null;
    created_at: string;
};

export type ProgramAssignment = {
    activeProgram: ActiveProgram;
    entry: ProgramScheduleEntry;
    carryForward: boolean;
};

export async function getProgramScheduleEntryById(
    id: string,
    supabase?: SupabaseClient
): Promise<ProgramScheduleEntry | null> {
    if (!id?.trim()) return null;
    const client = getClient(supabase);
    const { data, error } = await client
        .from('fitness_program_schedule')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) {
        console.error('getProgramScheduleEntryById:', error);
        throw error;
    }
    return (data ?? null) as ProgramScheduleEntry | null;
}

function toDateOnly(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateOnly(s: string): Date {
    return new Date(`${s}T12:00:00`);
}

function nextDatesForWeekdays(start: Date, weekdays: number[], count: number): string[] {
    const sorted = [...new Set(weekdays)].sort((a, b) => a - b);
    const out: string[] = [];
    let d = new Date(start);
    while (out.length < count) {
        if (sorted.includes(d.getDay())) out.push(toDateOnly(d));
        d.setDate(d.getDate() + 1);
    }
    return out;
}

function modeForLevel(level: FitnessTrainingLevel): 'conservative' | 'aggressive' {
    return level === 'advanced' ? 'aggressive' : 'conservative';
}

export async function activateProgramForUser(params: {
    userId: string;
    planId: string;
    trainingWeekdays: number[];
    trainingLevel: FitnessTrainingLevel;
    supabase?: SupabaseClient;
}): Promise<ActiveProgram> {
    const client = getClient(params.supabase);
    const weekdays = [...new Set(params.trainingWeekdays)].sort((a, b) => a - b);
    if (weekdays.length === 0) throw new Error('At least one training day is required.');
    const plan = await getWorkoutPlanWithItems(params.planId, client);
    if (!plan || plan.items.length === 0) throw new Error('Plan not found or has no items.');
    const maxDay = plan.items.reduce((m, i) => Math.max(m, i.day_index || 1), 1);

    const { data: activeData, error: activeErr } = await client
        .from('fitness_active_programs')
        .upsert(
            {
                user_id: params.userId,
                plan_id: params.planId,
                status: 'active',
                progression_mode: modeForLevel(params.trainingLevel),
                start_date: toDateOnly(new Date()),
                training_weekdays: weekdays,
            },
            { onConflict: 'user_id' }
        )
        .select('*')
        .single();
    if (activeErr) {
        console.error('activateProgramForUser (active):', activeErr);
        throw activeErr;
    }
    const active = activeData as ActiveProgram;

    await client
        .from('fitness_program_schedule')
        .delete()
        .eq('active_program_id', active.id)
        .neq('status', 'completed');

    const dates = nextDatesForWeekdays(new Date(), weekdays, 28);
    const payload = dates.map((date, idx) => ({
        active_program_id: active.id,
        scheduled_date: date,
        day_index: (idx % maxDay) + 1,
        status: 'scheduled',
    }));
    const { error: schedErr } = await client.from('fitness_program_schedule').insert(payload);
    if (schedErr) {
        console.error('activateProgramForUser (schedule):', schedErr);
        throw schedErr;
    }
    return active;
}

export async function syncProgramScheduleForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<void> {
    const client = getClient(supabase);
    const { data: activeData } = await client
        .from('fitness_active_programs')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    if (!activeData) return;
    const active = activeData as ActiveProgram;
    const today = toDateOnly(new Date());

    await client
        .from('fitness_program_schedule')
        .update({ status: 'missed' })
        .eq('active_program_id', active.id)
        .eq('status', 'scheduled')
        .lt('scheduled_date', today);
}

export async function getCurrentProgramAssignmentForUser(
    userId: string,
    supabase?: SupabaseClient
): Promise<ProgramAssignment | null> {
    const client = getClient(supabase);
    await syncProgramScheduleForUser(userId, client);

    const { data: activeData } = await client
        .from('fitness_active_programs')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    if (!activeData) return null;
    const active = activeData as ActiveProgram;

    const today = toDateOnly(new Date());
    // Shift-forward behavior: carry oldest incomplete (scheduled or missed) <= today.
    const { data: carryData } = await client
        .from('fitness_program_schedule')
        .select('*')
        .eq('active_program_id', active.id)
        .in('status', ['scheduled', 'missed'])
        .lte('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(1);
    const carry = (carryData ?? [])[0] as ProgramScheduleEntry | undefined;
    if (carry) {
        return { activeProgram: active, entry: carry, carryForward: carry.status === 'missed' };
    }

    const { data: nextData } = await client
        .from('fitness_program_schedule')
        .select('*')
        .eq('active_program_id', active.id)
        .eq('status', 'scheduled')
        .gte('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(1);
    const next = (nextData ?? [])[0] as ProgramScheduleEntry | undefined;
    if (!next) return null;
    return { activeProgram: active, entry: next, carryForward: false };
}

export async function markProgramAssignmentCompletedForSession(params: {
    userId: string;
    planId: string | null;
    sessionId: string;
    sessionEndedAt: string;
    programScheduleId?: string | null;
    supabase?: SupabaseClient;
}): Promise<void> {
    if (!params.planId) return;
    const client = getClient(params.supabase);
    await syncProgramScheduleForUser(params.userId, client);

    const { data: activeData } = await client
        .from('fitness_active_programs')
        .select('*')
        .eq('user_id', params.userId)
        .eq('plan_id', params.planId)
        .eq('status', 'active')
        .maybeSingle();
    if (!activeData) return;
    const active = activeData as ActiveProgram;
    const endedDate = toDateOnly(parseDateOnly(params.sessionEndedAt));

    if (params.programScheduleId) {
        await client
            .from('fitness_program_schedule')
            .update({ status: 'completed', session_id: params.sessionId })
            .eq('id', params.programScheduleId)
            .eq('active_program_id', active.id);
        return;
    }

    const { data: rowData } = await client
        .from('fitness_program_schedule')
        .select('*')
        .eq('active_program_id', active.id)
        .in('status', ['scheduled', 'missed'])
        .lte('scheduled_date', endedDate)
        .order('scheduled_date', { ascending: true })
        .limit(1);
    const row = (rowData ?? [])[0] as ProgramScheduleEntry | undefined;
    if (!row) return;

    await client
        .from('fitness_program_schedule')
        .update({ status: 'completed', session_id: params.sessionId })
        .eq('id', row.id);
}

export async function getOrCreateScheduledSessionForAssignment(params: {
    userId: string;
    planId: string;
    dayIndex: number;
    scheduleEntryId: string;
    supabase?: SupabaseClient;
}): Promise<{ sessionId: string; created: boolean }> {
    const client = getClient(params.supabase);
    const { data: existing, error: existingError } = await client
        .from('fitness_workout_sessions')
        .select('id')
        .eq('user_id', params.userId)
        .eq('program_schedule_id', params.scheduleEntryId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (existingError) {
        console.error('getOrCreateScheduledSessionForAssignment (existing):', existingError);
        throw existingError;
    }
    if (existing?.id) return { sessionId: existing.id as string, created: false };

    const { createSessionFromPlanDay } = await import('./workoutSessions');
    const created = await createSessionFromPlanDay(
        params.planId,
        params.dayIndex,
        params.userId,
        { programScheduleId: params.scheduleEntryId },
        client
    );
    return { sessionId: created.id, created: true };
}
