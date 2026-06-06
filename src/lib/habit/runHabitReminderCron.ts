import type { SupabaseClient } from '@supabase/supabase-js';
import { sendUserPush } from '@/lib/push/sendUserPushNotification';
import {
    defaultHabitReminderPrefs,
    getLocalDateParts,
    habitReminderIdempotencyKey,
    isTimeInReminderWindow,
    parseHabitReminderPrefsFromRow,
    truncateList,
    type HabitReminderPrefs,
    type ReminderCategory,
} from '@/lib/habit/habitReminderUtils';

const REMINDER_WINDOW_MINUTES = 15;
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
    payload: Record<string, string>
): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
    const idempotencyKey = habitReminderIdempotencyKey(userId, dateStr, category, time);

    if (await wasReminderSent(supabase, idempotencyKey)) {
        return { sent: false, skipped: true };
    }

    const eventType =
        category === 'habits'
            ? 'habit_reminder'
            : category === 'priorities'
              ? 'priorities_reminder'
              : 'todos_reminder';

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

function activeTimes(times: string[], minutesSinceMidnight: number): string[] {
    return times.filter(time =>
        isTimeInReminderWindow(minutesSinceMidnight, time, REMINDER_WINDOW_MINUTES)
    );
}

async function processUserReminders(
    supabase: SupabaseClient,
    prefs: HabitReminderPrefs,
    summary: HabitReminderCronSummary
): Promise<void> {
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

    if (prefs.notify_priorities_enabled) {
        for (const time of activeTimes(prefs.priorities_reminder_times, minutesSinceMidnight)) {
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

    if (prefs.notify_todos_enabled) {
        for (const time of activeTimes(prefs.todos_reminder_times, minutesSinceMidnight)) {
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
        const habitTimes = activeTimes(prefs.habit_reminder_times, minutesSinceMidnight);
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

    for (const reminder of pending) {
        const result = await sendHabitReminder(
            supabase,
            prefs.user_id,
            reminder.category,
            reminder.time,
            dateStr,
            reminder.title,
            reminder.body,
            reminder.payload
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

    const { data: prefsRows, error } = await supabase
        .from('habit_notification_preferences')
        .select('*')
        .in('user_id', userIds);

    if (error) {
        summary.errors.push(error.message);
        return summary;
    }

    const prefsByUser = new Map(
        (prefsRows ?? []).map(row =>
            [row.user_id, parseHabitReminderPrefsFromRow(row.user_id, row)]
        )
    );

    for (const userId of userIds) {
        const prefs = prefsByUser.get(userId) ?? defaultHabitReminderPrefs(userId);
        if (
            !prefs.notify_habits_enabled &&
            !prefs.notify_priorities_enabled &&
            !prefs.notify_todos_enabled
        ) {
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
