import type { SupabaseClient } from '@supabase/supabase-js';
import {
    getLocalDateParts,
    isTimeInReminderWindow,
    parseHabitReminderPrefsFromRow,
} from '@/lib/habit/habitReminderUtils';

/** Slightly wider than the 10-minute plaid cron interval to avoid missed windows. */
export const REMINDER_WINDOW_MINUTES = 12;

type HabitTemplate = {
    id: string;
    is_bad_habit: boolean;
};

type HabitEntry = {
    habit_template_id: string;
    status: string;
};

function incompleteHabitTemplates(
    templates: HabitTemplate[],
    entries: HabitEntry[]
): HabitTemplate[] {
    const checkedIds = new Set(
        entries.filter(e => e.status === 'checked').map(e => e.habit_template_id)
    );
    return templates.filter(t => !t.is_bad_habit && !checkedIds.has(t.id));
}

export function activeReminderTimes(
    times: string[],
    minutesSinceMidnight: number,
    windowMinutes = REMINDER_WINDOW_MINUTES
): string[] {
    return times.filter(time =>
        isTimeInReminderWindow(minutesSinceMidnight, time, windowMinutes)
    );
}

export type HabitReminderDiagnostics = {
    pushSubscribed: boolean;
    habitsEnabled: boolean;
    habitReminderTimes: string[];
    timezone: string;
    localDate: string;
    localTime: string;
    activeHabitTimes: string[];
    incompleteHabitsCount: number;
    wouldSendHabitReminderNow: boolean;
    blockers: string[];
};

export async function getHabitReminderDiagnostics(
    supabase: SupabaseClient,
    userId: string
): Promise<HabitReminderDiagnostics> {
    const blockers: string[] = [];

    const [{ data: subs }, { data: prefsRow }] = await Promise.all([
        supabase
            .from('user_push_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .limit(1),
        supabase
            .from('habit_notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
    ]);

    const pushSubscribed = (subs?.length ?? 0) > 0;
    if (!pushSubscribed) {
        blockers.push('Push notifications are not enabled (no device subscription).');
    }

    const prefs = parseHabitReminderPrefsFromRow(userId, prefsRow);
    if (!prefs.notify_habits_enabled) {
        blockers.push('Habit reminders are turned off in settings.');
    }
    if (prefs.habit_reminder_times.length === 0) {
        blockers.push('No habit reminder times are configured.');
    }

    let local: ReturnType<typeof getLocalDateParts>;
    try {
        local = getLocalDateParts(prefs.timezone);
    } catch {
        blockers.push(`Invalid timezone "${prefs.timezone}".`);
        local = getLocalDateParts('America/New_York');
    }

    const [{ data: templates }, { data: entries }] = await Promise.all([
        supabase
            .from('habit_templates')
            .select('id, is_bad_habit')
            .eq('user_id', userId)
            .eq('is_active', true),
        supabase
            .from('habit_daily_entries')
            .select('habit_template_id, status')
            .eq('user_id', userId)
            .eq('date', local.dateStr),
    ]);

    const incomplete = incompleteHabitTemplates(
        (templates ?? []) as HabitTemplate[],
        (entries ?? []) as HabitEntry[]
    );

    if (incomplete.length === 0) {
        blockers.push('All active habits are already checked in for today.');
    }

    const activeHabitTimes = activeReminderTimes(
        prefs.habit_reminder_times,
        local.minutesSinceMidnight
    );

    if (prefs.notify_habits_enabled && prefs.habit_reminder_times.length > 0 && activeHabitTimes.length === 0) {
        blockers.push(
            `Current local time (${formatMinutes(local.minutesSinceMidnight)}) is outside the ${REMINDER_WINDOW_MINUTES}-minute window for your scheduled times (${prefs.habit_reminder_times.join(', ')}). Reminders are checked every 10 minutes.`
        );
    }

    const wouldSendHabitReminderNow =
        pushSubscribed &&
        prefs.notify_habits_enabled &&
        prefs.habit_reminder_times.length > 0 &&
        activeHabitTimes.length > 0 &&
        incomplete.length > 0;

    return {
        pushSubscribed,
        habitsEnabled: prefs.notify_habits_enabled,
        habitReminderTimes: prefs.habit_reminder_times,
        timezone: prefs.timezone,
        localDate: local.dateStr,
        localTime: formatMinutes(local.minutesSinceMidnight),
        activeHabitTimes,
        incompleteHabitsCount: incomplete.length,
        wouldSendHabitReminderNow,
        blockers,
    };
}

function formatMinutes(total: number): string {
    const hour = Math.floor(total / 60) % 24;
    const minute = total % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export { incompleteHabitTemplates };
