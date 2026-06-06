import type { SupabaseClient } from '@supabase/supabase-js';
import { sendUserPush } from '@/lib/push/sendUserPushNotification';
import {
    addDaysToDateStr,
    buildPlanTomorrowNotification,
    buildScoreRecapNotification,
    getDisplayFirstName,
    isWeekendInTimezone,
} from '@/lib/habit/habitNotificationCopy';
import { computeDailyScoreSnapshot } from '@/lib/habit/computeDailyScores';
import type { TimeOfDay } from '@/lib/habitHelpers';
import {
    activeReminderTimes,
    REMINDER_WINDOW_MINUTES,
} from '@/lib/habit/habitReminderDiagnostics';
import {
    defaultHabitReminderPrefs,
    getLocalDateParts,
    habitReminderIdempotencyKey,
    isAnyHabitNotificationEnabled,
    isTimeInReminderWindow,
    parseHabitReminderPrefsFromRow,
    truncateList,
    type HabitReminderPrefs,
    type ReminderCategory,
} from '@/lib/habit/habitReminderUtils';

const HABIT_DASHBOARD_URL = '/dashboard';

type HabitTemplate = {
    id: string;
    name: string;
    icon: string | null;
    is_bad_habit: boolean;
};

type HabitEntry = {
    habit_template_id: string;
    status: string;
};

export type HabitReminderCronSummary = {
    users_checked: number;
    reminders_sent: number;
    reminders_skipped: number;
    errors: string[];
};

export type ProcessUserRemindersOptions = {
    ignoreTimeWindow?: boolean;
    forceIdempotencySuffix?: string;
    habitsOnly?: boolean;
    firstName?: string | null;
};

function notificationEventType(category: ReminderCategory): string {
    if (
        category === 'morning_score' ||
        category === 'afternoon_score' ||
        category === 'evening_score'
    ) {
        return 'score_recap';
    }
    if (category === 'plan_tomorrow') return 'plan_tomorrow_reminder';
    if (category === 'habits') return 'habit_reminder';
    if (category === 'priorities') return 'priorities_reminder';
    return 'todos_reminder';
}

async function resolveFirstName(
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> {
    try {
        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (error || !data.user) return null;
        return getDisplayFirstName(data.user.user_metadata);
    } catch {
        return null;
    }
}

function isScheduledTimeDue(
    time: string,
    minutesSinceMidnight: number,
    ignoreTimeWindow: boolean
): boolean {
    if (ignoreTimeWindow) return true;
    return isTimeInReminderWindow(
        minutesSinceMidnight,
        time,
        REMINDER_WINDOW_MINUTES
    );
}

async function wasReminderSent(
    supabase: SupabaseClient,
    idempotencyKey: string
): Promise<boolean> {
    const { data } = await supabase
        .from('notification_events')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
    return Boolean(data);
}

async function sendHabitReminder(
    supabase: SupabaseClient,
    userId: string,
    category: ReminderCategory,
    time: string,
    dateStr: string,
    title: string,
    body: string,
    payload: Record<string, string>,
    idempotencySuffix?: string
): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
    const idempotencyKey = idempotencySuffix
        ? `${habitReminderIdempotencyKey(userId, dateStr, category, time)}:${idempotencySuffix}`
        : habitReminderIdempotencyKey(userId, dateStr, category, time);

    if (await wasReminderSent(supabase, idempotencyKey)) {
        return { sent: false, skipped: true };
    }

    const eventType = notificationEventType(category);

    const { error: eventError } = await supabase.from('notification_events').insert({
        user_id: userId,
        idempotency_key: idempotencyKey,
        channel: 'push',
        event_type: eventType,
        title,
        body,
        payload: { category, time, date: dateStr, ...payload },
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
            type: eventType,
            kind: `${category}_${time.replace(':', '')}`,
            category,
            time,
            url: HABIT_DASHBOARD_URL,
            date: dateStr,
            ...payload,
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

function incompleteHabits(
    templates: HabitTemplate[],
    entries: HabitEntry[]
): HabitTemplate[] {
    const checkedIds = new Set(
        entries.filter(e => e.status === 'checked').map(e => e.habit_template_id)
    );

    return templates.filter(t => !t.is_bad_habit && !checkedIds.has(t.id));
}

function timesForCategory(
    times: string[],
    minutesSinceMidnight: number,
    ignoreTimeWindow: boolean
): string[] {
    if (ignoreTimeWindow) {
        return times.length > 0 ? [times[0]] : [];
    }
    return activeReminderTimes(times, minutesSinceMidnight, REMINDER_WINDOW_MINUTES);
}

export async function processUserReminders(
    supabase: SupabaseClient,
    prefs: HabitReminderPrefs,
    summary: HabitReminderCronSummary,
    options: ProcessUserRemindersOptions = {}
): Promise<void> {
    const { ignoreTimeWindow = false, forceIdempotencySuffix, habitsOnly = false, firstName } =
        options;

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
    const pending: Array<{
        category: ReminderCategory;
        time: string;
        title: string;
        body: string;
        payload: Record<string, string>;
    }> = [];

    if (prefs.notify_priorities_enabled && !habitsOnly) {
        for (const time of timesForCategory(
            prefs.priorities_reminder_times,
            minutesSinceMidnight,
            ignoreTimeWindow
        )) {
            const { count } = await supabase
                .from('habit_daily_priorities')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', prefs.user_id)
                .eq('date', dateStr);

            if ((count ?? 0) === 0) {
                pending.push({
                    category: 'priorities',
                    time,
                    title: 'Set your priorities',
                    body: 'What are your top 3 priorities for today? Tap to open your habit tracker.',
                    payload: { section: 'priorities' },
                });
            } else {
                const { data: priorities } = await supabase
                    .from('habit_daily_priorities')
                    .select('completed')
                    .eq('user_id', prefs.user_id)
                    .eq('date', dateStr);

                const incomplete = (priorities ?? []).filter(p => !p.completed);
                if (incomplete.length > 0) {
                    pending.push({
                        category: 'priorities',
                        time,
                        title: 'Priorities still open',
                        body: `You have ${incomplete.length} priorit${incomplete.length === 1 ? 'y' : 'ies'} left today.`,
                        payload: {
                            section: 'priorities',
                            count: String(incomplete.length),
                        },
                    });
                }
            }
        }
    }

    if (prefs.notify_todos_enabled && !habitsOnly) {
        for (const time of timesForCategory(
            prefs.todos_reminder_times,
            minutesSinceMidnight,
            ignoreTimeWindow
        )) {
            const { data: todos } = await supabase
                .from('habit_daily_todos')
                .select('title, is_done')
                .eq('user_id', prefs.user_id)
                .eq('date', dateStr);

            const list = todos ?? [];
            if (list.length === 0) {
                pending.push({
                    category: 'todos',
                    time,
                    title: 'Plan your day',
                    body: 'Add your to-do list for today. Tap to open your habit tracker.',
                    payload: { section: 'todos' },
                });
                continue;
            }

            const incomplete = list.filter(t => !t.is_done);
            if (incomplete.length > 0) {
                const names = incomplete.map(t => t.title).filter(Boolean);
                pending.push({
                    category: 'todos',
                    time,
                    title: 'To-dos still open',
                    body:
                        incomplete.length === 1
                            ? `Still on your list: ${names[0]}`
                            : `You have ${incomplete.length} to-dos left: ${truncateList(names)}`,
                    payload: {
                        section: 'todos',
                        count: String(incomplete.length),
                    },
                });
            }
        }
    }

    if (prefs.notify_habits_enabled) {
        const habitTimes = timesForCategory(
            prefs.habit_reminder_times,
            minutesSinceMidnight,
            ignoreTimeWindow
        );

        if (habitTimes.length > 0) {
            const [{ data: templates }, { data: entries }] = await Promise.all([
                supabase
                    .from('habit_templates')
                    .select('id, name, icon, is_bad_habit')
                    .eq('user_id', prefs.user_id)
                    .eq('is_active', true),
                supabase
                    .from('habit_daily_entries')
                    .select('habit_template_id, status')
                    .eq('user_id', prefs.user_id)
                    .eq('date', dateStr),
            ]);

            const incomplete = incompleteHabits(
                (templates ?? []) as HabitTemplate[],
                (entries ?? []) as HabitEntry[]
            );

            if (incomplete.length > 0) {
                const labels = incomplete.map(h => {
                    const icon = h.icon?.trim();
                    return icon ? `${icon} ${h.name}` : h.name;
                });

                for (const time of habitTimes) {
                    pending.push({
                        category: 'habits',
                        time,
                        title: 'Habit check-in',
                        body:
                            incomplete.length === 1
                                ? `Still to check in: ${labels[0]}`
                                : `${incomplete.length} habits left: ${truncateList(labels)}`,
                        payload: {
                            section: 'habits',
                            count: String(incomplete.length),
                        },
                    });
                }
            }
        }
    }

    const needsScoreOrPlan =
        !habitsOnly &&
        (prefs.notify_morning_score_enabled ||
            prefs.notify_afternoon_score_enabled ||
            prefs.notify_evening_score_enabled ||
            prefs.notify_plan_tomorrow_enabled);

    if (needsScoreOrPlan) {
        const resolvedName =
            firstName !== undefined ? firstName : await resolveFirstName(supabase, prefs.user_id);

        const [{ data: scoreTemplates }, { data: scoreEntries }, { data: priorities }, { data: todos }] =
            await Promise.all([
                supabase
                    .from('habit_templates')
                    .select('id, time_of_day, is_bad_habit')
                    .eq('user_id', prefs.user_id)
                    .eq('is_active', true),
                supabase
                    .from('habit_daily_entries')
                    .select('habit_template_id, status')
                    .eq('user_id', prefs.user_id)
                    .eq('date', dateStr),
                supabase
                    .from('habit_daily_priorities')
                    .select('completed')
                    .eq('user_id', prefs.user_id)
                    .eq('date', dateStr),
                supabase
                    .from('habit_daily_todos')
                    .select('is_done')
                    .eq('user_id', prefs.user_id)
                    .eq('date', dateStr),
            ]);

        const scores = computeDailyScoreSnapshot({
            templates: scoreTemplates ?? [],
            entries: scoreEntries ?? [],
            priorities: priorities ?? [],
            todos: todos ?? [],
        });

        const scoreConfigs: Array<{
            enabled: boolean;
            time: string;
            slot: TimeOfDay;
            category: ReminderCategory;
            slotScore: typeof scores.morning;
        }> = [
            {
                enabled: prefs.notify_morning_score_enabled,
                time: prefs.morning_score_time,
                slot: 'morning',
                category: 'morning_score',
                slotScore: scores.morning,
            },
            {
                enabled: prefs.notify_afternoon_score_enabled,
                time: prefs.afternoon_score_time,
                slot: 'afternoon',
                category: 'afternoon_score',
                slotScore: scores.afternoon,
            },
            {
                enabled: prefs.notify_evening_score_enabled,
                time: prefs.evening_score_time,
                slot: 'evening',
                category: 'evening_score',
                slotScore: scores.evening,
            },
        ];

        for (const config of scoreConfigs) {
            if (!config.enabled || !config.slotScore) continue;
            if (!isScheduledTimeDue(config.time, minutesSinceMidnight, ignoreTimeWindow)) continue;

            const recap = buildScoreRecapNotification({
                slot: config.slot,
                slotScore: config.slotScore,
                scoreOverall: scores.scoreOverall,
                gradeOverall: scores.gradeOverall,
                firstName: resolvedName,
                dateStr,
            });

            pending.push({
                category: config.category,
                time: config.time,
                title: recap.title,
                body: recap.body,
                payload: {
                    section: 'scores',
                    slot: config.slot,
                    score: String(config.slotScore.score),
                    grade: config.slotScore.grade,
                },
            });
        }

        if (
            prefs.notify_plan_tomorrow_enabled &&
            isScheduledTimeDue(prefs.plan_tomorrow_time, minutesSinceMidnight, ignoreTimeWindow)
        ) {
            const tomorrowDateStr = addDaysToDateStr(dateStr, 1);
            const [{ count: tomorrowPriorities }, { count: tomorrowTodos }] = await Promise.all([
                supabase
                    .from('habit_daily_priorities')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', prefs.user_id)
                    .eq('date', tomorrowDateStr),
                supabase
                    .from('habit_daily_todos')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', prefs.user_id)
                    .eq('date', tomorrowDateStr),
            ]);

            const planCopy = buildPlanTomorrowNotification({
                firstName: resolvedName,
                dateStr,
                tomorrowDateStr,
                tomorrowPrioritiesCount: tomorrowPriorities ?? 0,
                tomorrowTodosCount: tomorrowTodos ?? 0,
                todayScoreOverall: scores.scoreOverall,
                isWeekend: isWeekendInTimezone(prefs.timezone),
            });

            pending.push({
                category: 'plan_tomorrow',
                time: prefs.plan_tomorrow_time,
                title: planCopy.title,
                body: planCopy.body,
                payload: {
                    section: 'plan',
                    targetDate: tomorrowDateStr,
                },
            });
        }
    }

    for (const reminder of pending) {
        const result = await sendHabitReminder(
            supabase,
            prefs.user_id,
            reminder.category,
            reminder.time,
            dateStr,
            reminder.title,
            reminder.body,
            reminder.payload,
            forceIdempotencySuffix
        );

        if (result.sent) {
            summary.reminders_sent += 1;
        } else if (result.skipped) {
            summary.reminders_skipped += 1;
        } else if (result.error) {
            summary.errors.push(
                `${prefs.user_id}/${reminder.category}@${reminder.time}: ${result.error}`
            );
        }
    }
}

export async function runHabitRemindersForUser(
    supabase: SupabaseClient,
    userId: string,
    options: ProcessUserRemindersOptions = {}
): Promise<HabitReminderCronSummary> {
    const summary: HabitReminderCronSummary = {
        users_checked: 1,
        reminders_sent: 0,
        reminders_skipped: 0,
        errors: [],
    };

    const { data: prefsRow } = await supabase
        .from('habit_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    const prefs = parseHabitReminderPrefsFromRow(userId, prefsRow);

    if (!isAnyHabitNotificationEnabled(prefs)) {
        summary.reminders_skipped += 1;
        return summary;
    }

    await processUserReminders(supabase, prefs, summary, options);
    return summary;
}

export async function runHabitReminderCron(
    supabase: SupabaseClient
): Promise<HabitReminderCronSummary> {
    const summary: HabitReminderCronSummary = {
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

    const userIds = [...new Set((subs ?? []).map(s => s.user_id))];
    if (userIds.length === 0) {
        return summary;
    }

    const { data: prefsRows, error: prefsError } = await supabase
        .from('habit_notification_preferences')
        .select('*')
        .in('user_id', userIds);

    if (prefsError) {
        summary.errors.push(`habit_notification_preferences: ${prefsError.message}`);
    }

    const prefsByUser = new Map(
        (prefsRows ?? []).map(row =>
            [row.user_id, parseHabitReminderPrefsFromRow(row.user_id, row)]
        )
    );

    for (const userId of userIds) {
        const prefs = prefsByUser.get(userId) ?? defaultHabitReminderPrefs(userId);
        if (!isAnyHabitNotificationEnabled(prefs)) {
            continue;
        }

        summary.users_checked += 1;
        try {
            await processUserReminders(supabase, prefs, summary);
        } catch (err) {
            summary.errors.push(
                `${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`
            );
        }
    }

    return summary;
}
