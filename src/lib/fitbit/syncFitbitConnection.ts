import type { SupabaseClient } from '@supabase/supabase-js';
import { FITBIT_DEFAULT_BACKFILL_DAYS } from './fitbitConfig';
import { ensureValidFitbitToken, fitbitApiRequest } from './fitbitApi';
import type { FitbitProviderConnection, FitbitSyncCursor, FitbitSyncResult } from './types';

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function parseCursor(connection: FitbitProviderConnection): FitbitSyncCursor {
    return (connection.sync_cursor ?? {}) as FitbitSyncCursor;
}

function getSyncStartDate(cursorDate: string | undefined, backfillDays: number): string {
    const today = new Date();
    const backfillStart = addDays(today, -backfillDays);
    if (!cursorDate) {
        return formatDate(backfillStart);
    }

    const cursor = new Date(`${cursorDate}T00:00:00Z`);
    const start = cursor > backfillStart ? cursor : backfillStart;
    return formatDate(start);
}

function enumerateDates(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    while (current <= end) {
        dates.push(formatDate(current));
        current = addDays(current, 1);
    }

    return dates;
}

function mapFitbitActivityType(activityName: string): 'strength' | 'cardio' | 'mobility' | 'sport' | 'other' {
    const normalized = activityName.toLowerCase();
    if (normalized.includes('strength') || normalized.includes('weights') || normalized.includes('weight training')) {
        return 'strength';
    }
    if (normalized.includes('yoga') || normalized.includes('stretch') || normalized.includes('pilates')) {
        return 'mobility';
    }
    if (
        normalized.includes('run') ||
        normalized.includes('walk') ||
        normalized.includes('bike') ||
        normalized.includes('cycle') ||
        normalized.includes('cardio') ||
        normalized.includes('elliptical') ||
        normalized.includes('swim')
    ) {
        return 'cardio';
    }
    if (normalized.includes('sport') || normalized.includes('basketball') || normalized.includes('soccer')) {
        return 'sport';
    }
    return 'other';
}

async function upsertDailyMetrics(
    supabase: SupabaseClient,
    userId: string,
    date: string,
    patch: Record<string, string | number | null>
): Promise<void> {
    const { data: existing } = await supabase
        .from('fitness_metrics')
        .select('id, weight_kg, steps, water_ml, sleep_hours, steps_source, sleep_source, weight_source')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

    const payload = {
        user_id: userId,
        date,
        weight_kg: patch.weight_kg ?? existing?.weight_kg ?? null,
        steps: patch.steps ?? existing?.steps ?? null,
        water_ml: existing?.water_ml ?? null,
        sleep_hours: patch.sleep_hours ?? existing?.sleep_hours ?? null,
        steps_source: patch.steps_source ?? existing?.steps_source ?? null,
        sleep_source: patch.sleep_source ?? existing?.sleep_source ?? null,
        weight_source: patch.weight_source ?? existing?.weight_source ?? null,
        updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
        const { error } = await supabase.from('fitness_metrics').update(payload).eq('id', existing.id);
        if (error) throw new Error(`Failed to update fitness_metrics: ${error.message}`);
        return;
    }

    const { error } = await supabase.from('fitness_metrics').insert(payload);
    if (error) throw new Error(`Failed to insert fitness_metrics: ${error.message}`);
}

async function syncStepsForDate(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection,
    accessToken: string,
    date: string
): Promise<boolean> {
    const response = await fitbitApiRequest<{
        'activities-steps': Array<{ value: string; dateTime: string }>;
    }>(accessToken, `/1/user/-/activities/steps/date/${date}/1d.json`);

    const stepsEntry = response['activities-steps']?.[0];
    const steps = stepsEntry ? Number(stepsEntry.value) : null;
    if (steps === null || Number.isNaN(steps)) return false;

    await upsertDailyMetrics(supabase, connection.user_id, date, {
        steps,
        steps_source: 'fitbit',
    });
    return true;
}

async function syncSleepForDate(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection,
    accessToken: string,
    date: string
): Promise<boolean> {
    const response = await fitbitApiRequest<{
        sleep: Array<{ minutesAsleep: number; dateOfSleep: string; logId: number }>;
    }>(accessToken, `/1.2/user/-/sleep/date/${date}.json`);

    const sleepLogs = response.sleep ?? [];
    if (sleepLogs.length === 0) return false;

    const totalMinutes = sleepLogs.reduce((sum, log) => sum + (log.minutesAsleep ?? 0), 0);
    if (totalMinutes <= 0) return false;

    await upsertDailyMetrics(supabase, connection.user_id, date, {
        sleep_hours: Number((totalMinutes / 60).toFixed(2)),
        sleep_source: 'fitbit',
    });
    return true;
}

async function syncWeightForDate(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection,
    accessToken: string,
    date: string
): Promise<boolean> {
    const response = await fitbitApiRequest<{
        weight: Array<{ date: string; weight: number }>;
    }>(accessToken, `/1/user/-/body/log/weight/date/${date}.json`);

    const entries = response.weight ?? [];
    if (entries.length === 0) return false;

    const latest = entries[entries.length - 1];
    const weightKg = Number((latest.weight * 0.45359237).toFixed(2));

    await upsertDailyMetrics(supabase, connection.user_id, date, {
        weight_kg: weightKg,
        weight_source: 'fitbit',
    });
    return true;
}

async function syncHeartRateForDate(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection,
    accessToken: string,
    date: string
): Promise<boolean> {
    const response = await fitbitApiRequest<{
        'activities-heart': Array<{
            dateTime: string;
            value: {
                restingHeartRate?: number;
                heartRateZones?: Array<{ min: number; max: number; minutes: number }>;
            };
        }>;
    }>(accessToken, `/1/user/-/activities/heart/date/${date}/1d.json`);

    const heartEntry = response['activities-heart']?.[0];
    const restingHr = heartEntry?.value?.restingHeartRate;
    if (!restingHr) return false;

    const sourceId = `fitbit:resting_hr:${date}`;
    const { error } = await supabase.from('fitness_vital_samples').upsert(
        {
            user_id: connection.user_id,
            provider: 'fitbit',
            source_id: sourceId,
            metric_type: 'resting_hr',
            value: restingHr,
            unit: 'bpm',
            recorded_at: `${date}T12:00:00.000Z`,
        },
        { onConflict: 'user_id,provider,source_id' }
    );

    if (error) throw new Error(`Failed to upsert resting heart rate: ${error.message}`);
    return true;
}

async function syncWorkouts(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection,
    accessToken: string,
    startDate: string,
    endDate: string
): Promise<number> {
    const response = await fitbitApiRequest<{
        activities: Array<{
            logId: number;
            activityName: string;
            startTime: string;
            duration: number;
            calories: number;
            averageHeartRate?: number;
        }>;
    }>(
        accessToken,
        `/1/user/-/activities/list.json?afterDate=${startDate}&beforeDate=${endDate}&sort=asc&limit=100&offset=0`
    );

    let imported = 0;
    for (const activity of response.activities ?? []) {
        const date = activity.startTime.split('T')[0];
        const durationMinutes = Math.max(1, Math.round(activity.duration / 60000));
        const sourceId = String(activity.logId);

        const { error } = await supabase.from('fitness_workouts').upsert(
            {
                user_id: connection.user_id,
                date,
                type: mapFitbitActivityType(activity.activityName),
                muscle_group: null,
                duration_minutes: durationMinutes,
                intensity: null,
                calories_burned: activity.calories ?? null,
                source: 'fitbit',
                source_id: sourceId,
                notes: `Imported from Fitbit: ${activity.activityName}`,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,source,source_id', ignoreDuplicates: false }
        );

        if (error) {
            console.warn('[fitbit-sync] workout upsert failed:', error.message, sourceId);
            continue;
        }
        imported += 1;
    }

    return imported;
}

async function updateIntegrationStatus(
    supabase: SupabaseClient,
    userId: string,
    lastSyncedAt: string
): Promise<void> {
    const { data: existing } = await supabase
        .from('fitness_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', 'fitbit')
        .maybeSingle();

    if (existing?.id) {
        await supabase
            .from('fitness_integrations')
            .update({
                status: 'connected',
                last_synced_at: lastSyncedAt,
                updated_at: lastSyncedAt,
            })
            .eq('id', existing.id);
        return;
    }

    await supabase.from('fitness_integrations').insert({
        user_id: userId,
        provider: 'fitbit',
        status: 'connected',
        last_synced_at: lastSyncedAt,
    });
}

export async function syncFitbitConnection(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection,
    options?: { backfillDays?: number; triggeredBy?: 'webhook' | 'cron' | 'manual' | 'oauth' }
): Promise<FitbitSyncResult> {
    const backfillDays = options?.backfillDays ?? FITBIT_DEFAULT_BACKFILL_DAYS;
    const today = formatDate(new Date());
    const cursor = parseCursor(connection);

    let stepsDays = 0;
    let sleepDays = 0;
    let weightDays = 0;
    let heartRateDays = 0;
    let workouts = 0;

    try {
        const activeConnection = await ensureValidFitbitToken(supabase, connection);
        const accessToken = activeConnection.access_token;

        const stepsStart = getSyncStartDate(cursor.steps, backfillDays);
        const sleepStart = getSyncStartDate(cursor.sleep, backfillDays);
        const weightStart = getSyncStartDate(cursor.weight, backfillDays);
        const heartStart = getSyncStartDate(cursor.heart_rate, backfillDays);
        const workoutsStart = getSyncStartDate(cursor.workouts, backfillDays);

        for (const date of enumerateDates(stepsStart, today)) {
            if (await syncStepsForDate(supabase, activeConnection, accessToken, date)) {
                stepsDays += 1;
            }
        }

        for (const date of enumerateDates(sleepStart, today)) {
            if (await syncSleepForDate(supabase, activeConnection, accessToken, date)) {
                sleepDays += 1;
            }
        }

        for (const date of enumerateDates(weightStart, today)) {
            if (await syncWeightForDate(supabase, activeConnection, accessToken, date)) {
                weightDays += 1;
            }
        }

        for (const date of enumerateDates(heartStart, today)) {
            if (await syncHeartRateForDate(supabase, activeConnection, accessToken, date)) {
                heartRateDays += 1;
            }
        }

        workouts = await syncWorkouts(supabase, activeConnection, accessToken, workoutsStart, today);

        const now = new Date().toISOString();
        const nextCursor: FitbitSyncCursor = {
            steps: today,
            sleep: today,
            weight: today,
            heart_rate: today,
            workouts: today,
        };

        const updatePayload: Record<string, unknown> = {
            sync_cursor: nextCursor,
            last_successful_sync_at: now,
            error_code: null,
            error_message: null,
            updated_at: now,
        };

        if (options?.triggeredBy === 'cron') {
            updatePayload.last_cron_sync_at = now;
        }
        if (options?.triggeredBy === 'webhook') {
            updatePayload.last_webhook_at = now;
        }

        await supabase.from('fitness_provider_connections').update(updatePayload).eq('id', activeConnection.id);
        await updateIntegrationStatus(supabase, activeConnection.user_id, now);

        return {
            connection_id: activeConnection.id,
            success: true,
            steps_days: stepsDays,
            sleep_days: sleepDays,
            weight_days: weightDays,
            workouts,
            heart_rate_days: heartRateDays,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Fitbit sync failed';
        const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code) : 'sync_error';

        await supabase
            .from('fitness_provider_connections')
            .update({
                error_code: code,
                error_message: message,
                updated_at: new Date().toISOString(),
            })
            .eq('id', connection.id);

        return {
            connection_id: connection.id,
            success: false,
            steps_days: stepsDays,
            sleep_days: sleepDays,
            weight_days: weightDays,
            workouts,
            heart_rate_days: heartRateDays,
            error: message,
        };
    }
}
