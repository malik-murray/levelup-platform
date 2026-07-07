import { NextRequest, NextResponse } from 'next/server';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';
import {
    fitnessPrefsToApiResponse,
    parseFitnessReminderPrefsFromRow,
} from '@/lib/fitness/fitnessReminderUtils';
import { parseTimeField, isValidReminderTime, normalizeTimeToHHMM } from '@/lib/habit/habitReminderUtils';

export type FitnessNotificationPreferencesBody = {
    notifyWorkoutReminderEnabled?: boolean;
    timezone?: string;
    workoutReminderTime?: string;
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
        .from('fitness_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    return NextResponse.json(fitnessPrefsToApiResponse(parseFitnessReminderPrefsFromRow(user.id, prefs)));
}

export async function PATCH(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as FitnessNotificationPreferencesBody;
    const token = authHeader!.replace('Bearer ', '').trim();
    const supabase = supabaseForUser(token);

    const update: Record<string, unknown> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
    };

    if (typeof body.notifyWorkoutReminderEnabled === 'boolean') {
        update.notify_workout_reminder_enabled = body.notifyWorkoutReminderEnabled;
    }
    if (typeof body.timezone === 'string' && body.timezone.trim()) {
        update.timezone = body.timezone.trim();
    }
    if (typeof body.workoutReminderTime === 'string') {
        if (!isValidReminderTime(normalizeTimeToHHMM(body.workoutReminderTime))) {
            return NextResponse.json({ error: 'Invalid workoutReminderTime' }, { status: 400 });
        }
        update.workout_reminder_time = parseTimeField(body.workoutReminderTime, '18:00');
    }

    const { error } = await supabase
        .from('fitness_notification_preferences')
        .upsert(update, { onConflict: 'user_id' });

    if (error) {
        console.error('[fitness-preferences]', error.message);
        return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
