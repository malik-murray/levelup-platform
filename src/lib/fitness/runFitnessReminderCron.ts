import type { SupabaseClient } from '@supabase/supabase-js';
import { sendUserPush } from '@/lib/push/sendUserPushNotification';
import { getLocalDateParts, isTimeInReminderWindow } from '@/lib/habit/habitReminderUtils';
import { REMINDER_WINDOW_MINUTES } from '@/lib/habit/habitReminderDiagnostics';
import {
    defaultFitnessReminderPrefs,
    fitnessReminderIdempotencyKey,
    parseFitnessReminderPrefsFromRow,
    type FitnessReminderPrefs,
} from './fitnessReminderUtils';
import { getCurrentProgramAssignmentForUser } from './programEngine';
import { listCompletedSessionsForUser } from './workoutSessions';

const FITNESS_DASHBOARD_URL = '/dashboard';

export type FitnessReminderCronSummary = {
    users_checked: number;
    reminders_sent: number;
    reminders_skipped: number;
    errors: string[];
};

function sessionLocalDateStr(iso: string, timezone: string): string {
    try {
        return getLocalDateParts(timezone, new Date(iso)).dateStr;
    } catch {
        return getLocalDateParts('America/New_York', new Date(iso)).dateStr;
    }
}

async function trainedTodayLocal(
    supabase: SupabaseClient,
    userId: string,
    timezone: string,
    dateStr: string
): Promise<boolean> {
    const sessions = await listCompletedSessionsForUser(userId, supabase, 20);
    return sessions.some(
        (s) => sessionLocalDateStr(s.ended_at ?? s.started_at, timezone) === dateStr
    );
}

async function wasReminderSent(supabase: SupabaseClient, idempotencyKey: string): Promise<boolean> {
    const { data } = await supabase
        .from('notification_events')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
    return Boolean(data);
}

async function sendWorkoutReminder(
    supabase: SupabaseClient,
    userId: string,
    time: string,
    dateStr: string,
    title: string,
    body: string
): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
    const idempotencyKey = fitnessReminderIdempotencyKey(userId, dateStr, time);

    if (await wasReminderSent(supabase, idempotencyKey)) {
        return { sent: false, skipped: true };
    }

    const { error: eventError } = await supabase.from('notification_events').insert({
        user_id: userId,
        idempotency_key: idempotencyKey,
        channel: 'push',
        event_type: 'fitness_workout_reminder',
        title,
        body,
        payload: { time, date: dateStr },
        delivery_status: 'pending',
    });

    if (eventError) {
        if (eventError.code === '23505') {
            return { sent: false, skipped: true };
        }
        return { sent: false, skipped: false, error: eventError.message };
    }

    const pushResult = await sendUserPush(supabase, {
        userId,
        title,
        body,
        data: {
            type: 'fitness_workout_reminder',
            url: FITNESS_DASHBOARD_URL,
            date: dateStr,
        },
    });

    await supabase
        .from('notification_events')
        .update({
            delivery_status: pushResult.sent ? 'sent' : pushResult.skipped ? 'skipped' : 'failed',
            delivery_error: pushResult.error ?? null,
        })
        .eq('idempotency_key', idempotencyKey);

    return pushResult;
}

export async function processUserFitnessReminder(
    supabase: SupabaseClient,
    prefs: FitnessReminderPrefs,
    summary: FitnessReminderCronSummary,
    options: { ignoreTimeWindow?: boolean } = {}
): Promise<void> {
    const { ignoreTimeWindow = false } = options;

    const { data: subs } = await supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', prefs.user_id)
        .limit(1);

    if (!subs?.length) {
        summary.reminders_skipped += 1;
        return;
    }

    let local: { dateStr: string; minutesSinceMidnight: number };
    try {
        local = getLocalDateParts(prefs.timezone);
    } catch {
        local = getLocalDateParts('America/New_York');
    }
    const { dateStr, minutesSinceMidnight } = local;

    if (
        !ignoreTimeWindow &&
        !isTimeInReminderWindow(minutesSinceMidnight, prefs.workout_reminder_time, REMINDER_WINDOW_MINUTES)
    ) {
        summary.reminders_skipped += 1;
        return;
    }

    const assignment = await getCurrentProgramAssignmentForUser(prefs.user_id, supabase);
    if (!assignment || assignment.entry.scheduled_date !== dateStr) {
        summary.reminders_skipped += 1;
        return;
    }

    const trainedToday = await trainedTodayLocal(supabase, prefs.user_id, prefs.timezone, dateStr);
    if (trainedToday) {
        summary.reminders_skipped += 1;
        return;
    }

    const result = await sendWorkoutReminder(
        supabase,
        prefs.user_id,
        prefs.workout_reminder_time,
        dateStr,
        "Don't break your streak",
        assignment.carryForward
            ? 'You have a workout waiting — keep your consistency going.'
            : "Today's workout is still open. Get it in before the day ends."
    );

    if (result.sent) {
        summary.reminders_sent += 1;
    } else if (result.skipped) {
        summary.reminders_skipped += 1;
    } else if (result.error) {
        summary.errors.push(`${prefs.user_id}: ${result.error}`);
    }
}

export async function runFitnessRemindersForUser(
    supabase: SupabaseClient,
    userId: string,
    options: { ignoreTimeWindow?: boolean } = {}
): Promise<FitnessReminderCronSummary> {
    const summary: FitnessReminderCronSummary = {
        users_checked: 1,
        reminders_sent: 0,
        reminders_skipped: 0,
        errors: [],
    };

    const { data: prefsRow } = await supabase
        .from('fitness_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    const prefs = parseFitnessReminderPrefsFromRow(userId, prefsRow);
    if (!prefs.notify_workout_reminder_enabled) {
        summary.reminders_skipped += 1;
        return summary;
    }

    await processUserFitnessReminder(supabase, prefs, summary, options);
    return summary;
}

export async function runFitnessReminderCron(
    supabase: SupabaseClient
): Promise<FitnessReminderCronSummary> {
    const summary: FitnessReminderCronSummary = {
        users_checked: 0,
        reminders_sent: 0,
        reminders_skipped: 0,
        errors: [],
    };

    const { data: subs, error: subsError } = await supabase
        .from('user_push_subscriptions')
        .select('user_id');

    if (subsError) {
        summary.errors.push(subsError.message);
        return summary;
    }

    const userIds = [...new Set((subs ?? []).map((s) => s.user_id))];
    if (userIds.length === 0) return summary;

    const { data: prefsRows, error: prefsError } = await supabase
        .from('fitness_notification_preferences')
        .select('*')
        .in('user_id', userIds);

    if (prefsError) {
        summary.errors.push(`fitness_notification_preferences: ${prefsError.message}`);
    }

    const prefsByUser = new Map(
        (prefsRows ?? []).map((row) => [row.user_id, parseFitnessReminderPrefsFromRow(row.user_id, row)])
    );

    for (const userId of userIds) {
        const prefs = prefsByUser.get(userId) ?? defaultFitnessReminderPrefs(userId);
        if (!prefs.notify_workout_reminder_enabled) continue;

        summary.users_checked += 1;
        try {
            await processUserFitnessReminder(supabase, prefs, summary);
        } catch (err) {
            summary.errors.push(`${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }

    return summary;
}
