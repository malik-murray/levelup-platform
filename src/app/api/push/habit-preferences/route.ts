import { NextRequest, NextResponse } from 'next/server';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';
import {
    parseHabitReminderPrefsFromRow,
    prefsToApiResponse,
    parseTimeField,
    validateTimeListInput,
} from '@/lib/habit/habitReminderUtils';

export type HabitNotificationPreferencesBody = {
    notifyHabitsEnabled?: boolean;
    notifyPrioritiesEnabled?: boolean;
    notifyTodosEnabled?: boolean;
    notifyMorningScoreEnabled?: boolean;
    notifyAfternoonScoreEnabled?: boolean;
    notifyEveningScoreEnabled?: boolean;
    notifyPlanTomorrowEnabled?: boolean;
    timezone?: string;
    habitReminderTimes?: string[];
    prioritiesReminderTimes?: string[];
    todosReminderTimes?: string[];
    morningScoreTime?: string;
    afternoonScoreTime?: string;
    eveningScoreTime?: string;
    planTomorrowTime?: string;
};

const SINGLE_TIME_FIELDS: Array<[keyof HabitNotificationPreferencesBody, string]> = [
    ['morningScoreTime', 'morning_score_time'],
    ['afternoonScoreTime', 'afternoon_score_time'],
    ['eveningScoreTime', 'evening_score_time'],
    ['planTomorrowTime', 'plan_tomorrow_time'],
];

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader!.replace('Bearer ', '').trim();
    const supabase = supabaseForUser(token);

    const { data: prefs } = await supabase
        .from('habit_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    return NextResponse.json(
        prefsToApiResponse(parseHabitReminderPrefsFromRow(user.id, prefs))
    );
}

export async function PATCH(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as HabitNotificationPreferencesBody;
    const token = authHeader!.replace('Bearer ', '').trim();
    const supabase = supabaseForUser(token);

    const update: Record<string, unknown> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
    };

    if (typeof body.notifyHabitsEnabled === 'boolean') {
        update.notify_habits_enabled = body.notifyHabitsEnabled;
    }
    if (typeof body.notifyPrioritiesEnabled === 'boolean') {
        update.notify_priorities_enabled = body.notifyPrioritiesEnabled;
    }
    if (typeof body.notifyTodosEnabled === 'boolean') {
        update.notify_todos_enabled = body.notifyTodosEnabled;
    }
    if (typeof body.notifyMorningScoreEnabled === 'boolean') {
        update.notify_morning_score_enabled = body.notifyMorningScoreEnabled;
    }
    if (typeof body.notifyAfternoonScoreEnabled === 'boolean') {
        update.notify_afternoon_score_enabled = body.notifyAfternoonScoreEnabled;
    }
    if (typeof body.notifyEveningScoreEnabled === 'boolean') {
        update.notify_evening_score_enabled = body.notifyEveningScoreEnabled;
    }
    if (typeof body.notifyPlanTomorrowEnabled === 'boolean') {
        update.notify_plan_tomorrow_enabled = body.notifyPlanTomorrowEnabled;
    }
    if (typeof body.timezone === 'string' && body.timezone.trim()) {
        update.timezone = body.timezone.trim();
    }

    const timeArrayFields: Array<[keyof HabitNotificationPreferencesBody, string]> = [
        ['habitReminderTimes', 'habit_reminder_times'],
        ['prioritiesReminderTimes', 'priorities_reminder_times'],
        ['todosReminderTimes', 'todos_reminder_times'],
    ];

    for (const [bodyKey, dbKey] of timeArrayFields) {
        const value = body[bodyKey];
        if (value !== undefined) {
            const validated = validateTimeListInput(value);
            if (validated === null) {
                return NextResponse.json(
                    { error: `Invalid reminder times for ${bodyKey}` },
                    { status: 400 }
                );
            }
            update[dbKey] = validated;
        }
    }

    for (const [bodyKey, dbKey] of SINGLE_TIME_FIELDS) {
        const value = body[bodyKey];
        if (typeof value === 'string') {
            update[dbKey] = parseTimeField(value, '12:00');
        }
    }

    const { error } = await supabase
        .from('habit_notification_preferences')
        .upsert(update, { onConflict: 'user_id' });

    if (error) {
        console.error('[habit-preferences]', error.message);
        return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
