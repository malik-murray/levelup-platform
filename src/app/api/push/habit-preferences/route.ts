import { NextRequest, NextResponse } from 'next/server';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';
import {
    parseHabitReminderPrefsFromRow,
    prefsToApiResponse,
    validateTimeListInput,
} from '@/lib/habit/habitReminderUtils';

export type HabitNotificationPreferencesBody = {
    notifyHabitsEnabled?: boolean;
    notifyPrioritiesEnabled?: boolean;
    notifyTodosEnabled?: boolean;
    timezone?: string;
    habitReminderTimes?: string[];
    prioritiesReminderTimes?: string[];
    todosReminderTimes?: string[];
};

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
    if (typeof body.timezone === 'string' && body.timezone.trim()) {
        update.timezone = body.timezone.trim();
    }

    const timeArrayFields: Array<
        [keyof HabitNotificationPreferencesBody, string]
    > = [
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

    const { error } = await supabase
        .from('habit_notification_preferences')
        .upsert(update, { onConflict: 'user_id' });

    if (error) {
        console.error('[habit-preferences]', error.message);
        return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
