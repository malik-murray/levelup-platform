export type ReminderCategory = 'habits' | 'priorities' | 'todos';

export type HabitReminderPrefs = {
    user_id: string;
    notify_habits_enabled: boolean;
    notify_priorities_enabled: boolean;
    notify_todos_enabled: boolean;
    timezone: string;
    habit_reminder_times: string[];
    priorities_reminder_times: string[];
    todos_reminder_times: string[];
};

export const DEFAULT_HABIT_REMINDER_TIMES = ['08:00', '14:00', '20:00'];
export const DEFAULT_PRIORITIES_REMINDER_TIMES = ['07:30'];
export const DEFAULT_TODOS_REMINDER_TIMES = ['09:00', '18:00'];
export const MAX_REMINDER_TIMES_PER_CATEGORY = 8;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseTimeToMinutes(timeStr: string): number {
    const normalized = normalizeTimeToHHMM(timeStr);
    const [h, m] = normalized.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

export function normalizeTimeToHHMM(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return '08:00';
    const hour = Math.min(23, Math.max(0, Number(match[1])));
    const minute = Math.min(59, Math.max(0, Number(match[2])));
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isValidReminderTime(value: string): boolean {
    return TIME_PATTERN.test(normalizeTimeToHHMM(value));
}

/** Parse DB JSON / array into sorted, deduped HH:MM list. */
export function normalizeTimeList(times: unknown, fallback: string[]): string[] {
    let raw: unknown[] = [];
    if (Array.isArray(times)) {
        raw = times;
    } else if (typeof times === 'string') {
        try {
            const parsed = JSON.parse(times) as unknown;
            if (Array.isArray(parsed)) raw = parsed;
        } catch {
            raw = [];
        }
    }

    const normalized = raw
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map(normalizeTimeToHHMM)
        .filter(isValidReminderTime);

    const unique = [...new Set(normalized)].sort(
        (a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)
    );

    return unique.length > 0 ? unique : [...fallback];
}

/** True when local time falls in [target, target + windowMinutes). */
export function isTimeInReminderWindow(
    localMinutes: number,
    targetTime: string,
    windowMinutes: number
): boolean {
    const start = parseTimeToMinutes(targetTime);
    const end = start + windowMinutes;
    return localMinutes >= start && localMinutes < end;
}

export function getLocalDateParts(
    timezone: string,
    now = new Date()
): {
    dateStr: string;
    minutesSinceMidnight: number;
} {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(p => p.type === type)?.value ?? '0';

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hourRaw = Number(get('hour'));
    const hour = hourRaw === 24 ? 0 : hourRaw;
    const minute = Number(get('minute'));

    return {
        dateStr: `${year}-${month}-${day}`,
        minutesSinceMidnight: hour * 60 + minute,
    };
}

export function habitReminderIdempotencyKey(
    userId: string,
    dateStr: string,
    category: ReminderCategory,
    time: string
): string {
    return `habit:${userId}:${dateStr}:${category}:${normalizeTimeToHHMM(time)}`;
}

export function defaultHabitReminderPrefs(userId: string): HabitReminderPrefs {
    return {
        user_id: userId,
        notify_habits_enabled: true,
        notify_priorities_enabled: true,
        notify_todos_enabled: true,
        timezone: 'America/New_York',
        habit_reminder_times: [...DEFAULT_HABIT_REMINDER_TIMES],
        priorities_reminder_times: [...DEFAULT_PRIORITIES_REMINDER_TIMES],
        todos_reminder_times: [...DEFAULT_TODOS_REMINDER_TIMES],
    };
}

export function parseHabitReminderPrefsFromRow(
    userId: string,
    row: Record<string, unknown> | null | undefined
): HabitReminderPrefs {
    if (!row) return defaultHabitReminderPrefs(userId);

    const habitTimes = normalizeTimeList(row.habit_reminder_times, DEFAULT_HABIT_REMINDER_TIMES);
    const prioritiesTimes = normalizeTimeList(
        row.priorities_reminder_times,
        DEFAULT_PRIORITIES_REMINDER_TIMES
    );
    const todosTimes = normalizeTimeList(row.todos_reminder_times, DEFAULT_TODOS_REMINDER_TIMES);

    // Backward compat if migration 072 has not run yet
    const legacyHabitTimes = [
        row.morning_habit_time,
        row.afternoon_habit_time,
        row.evening_habit_time,
    ]
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .map(t => normalizeTimeToHHMM(t));

    const legacyPriorities =
        typeof row.priorities_reminder_time === 'string'
            ? [normalizeTimeToHHMM(row.priorities_reminder_time)]
            : [];
    const legacyTodos = [row.todos_setup_reminder_time, row.todos_finish_reminder_time]
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .map(t => normalizeTimeToHHMM(t));

    return {
        user_id: userId,
        notify_habits_enabled: row.notify_habits_enabled !== false,
        notify_priorities_enabled: row.notify_priorities_enabled !== false,
        notify_todos_enabled: row.notify_todos_enabled !== false,
        timezone:
            typeof row.timezone === 'string' && row.timezone.trim()
                ? row.timezone.trim()
                : 'America/New_York',
        habit_reminder_times:
            row.habit_reminder_times != null
                ? habitTimes
                : legacyHabitTimes.length > 0
                  ? [...new Set(legacyHabitTimes)]
                  : habitTimes,
        priorities_reminder_times:
            row.priorities_reminder_times != null
                ? prioritiesTimes
                : legacyPriorities.length > 0
                  ? legacyPriorities
                  : prioritiesTimes,
        todos_reminder_times:
            row.todos_reminder_times != null
                ? todosTimes
                : legacyTodos.length > 0
                  ? [...new Set(legacyTodos)]
                  : todosTimes,
    };
}

export function truncateList(items: string[], max = 3): string {
    if (items.length <= max) return items.join(', ');
    const shown = items.slice(0, max).join(', ');
    return `${shown} +${items.length - max} more`;
}

export function validateTimeListInput(times: unknown): string[] | null {
    if (!Array.isArray(times)) return null;
    if (times.length === 0) return [];
    if (times.length > MAX_REMINDER_TIMES_PER_CATEGORY) return null;

    const normalized = times
        .filter((t): t is string => typeof t === 'string')
        .map(normalizeTimeToHHMM);

    if (normalized.some(t => !isValidReminderTime(t))) return null;
    return [...new Set(normalized)].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
}

export function prefsToApiResponse(prefs: HabitReminderPrefs) {
    return {
        notifyHabitsEnabled: prefs.notify_habits_enabled,
        notifyPrioritiesEnabled: prefs.notify_priorities_enabled,
        notifyTodosEnabled: prefs.notify_todos_enabled,
        timezone: prefs.timezone,
        habitReminderTimes: prefs.habit_reminder_times,
        prioritiesReminderTimes: prefs.priorities_reminder_times,
        todosReminderTimes: prefs.todos_reminder_times,
    };
}
