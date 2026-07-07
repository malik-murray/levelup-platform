import {
    normalizeTimeToHHMM,
    parseTimeField,
} from '@/lib/habit/habitReminderUtils';

export const DEFAULT_WORKOUT_REMINDER_TIME = '18:00';

export type FitnessReminderPrefs = {
    user_id: string;
    notify_workout_reminder_enabled: boolean;
    timezone: string;
    workout_reminder_time: string;
};

export function defaultFitnessReminderPrefs(userId: string): FitnessReminderPrefs {
    return {
        user_id: userId,
        notify_workout_reminder_enabled: false,
        timezone: 'America/New_York',
        workout_reminder_time: DEFAULT_WORKOUT_REMINDER_TIME,
    };
}

export function parseFitnessReminderPrefsFromRow(
    userId: string,
    row: Record<string, unknown> | null | undefined
): FitnessReminderPrefs {
    if (!row) return defaultFitnessReminderPrefs(userId);

    return {
        user_id: userId,
        notify_workout_reminder_enabled: row.notify_workout_reminder_enabled === true,
        timezone:
            typeof row.timezone === 'string' && row.timezone.trim()
                ? row.timezone.trim()
                : 'America/New_York',
        workout_reminder_time: parseTimeField(row.workout_reminder_time, DEFAULT_WORKOUT_REMINDER_TIME),
    };
}

export function fitnessReminderIdempotencyKey(
    userId: string,
    dateStr: string,
    time: string
): string {
    return `fitness:${userId}:${dateStr}:${normalizeTimeToHHMM(time)}`;
}

export function fitnessPrefsToApiResponse(prefs: FitnessReminderPrefs) {
    return {
        notifyWorkoutReminderEnabled: prefs.notify_workout_reminder_enabled,
        timezone: prefs.timezone,
        workoutReminderTime: prefs.workout_reminder_time,
    };
}
