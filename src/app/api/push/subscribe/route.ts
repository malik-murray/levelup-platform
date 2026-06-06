import { NextRequest, NextResponse } from 'next/server';
import type { WebPushSubscriptionJson } from '@/lib/push/webPushServer';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader!.replace('Bearer ', '').trim();
    const body = (await request.json()) as {
        subscription?: WebPushSubscriptionJson;
        timezone?: string;
    };
    const subscription = body.subscription;

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 });
    }

    const supabase = supabaseForUser(token);

    const { error: subError } = await supabase.from('user_push_subscriptions').upsert(
        {
            user_id: user.id,
            token: subscription.endpoint,
            platform: 'web',
            push_subscription: subscription,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
    );

    if (subError) {
        console.error('[push-subscribe]', subError.message);
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    await supabase.from('finance_notification_preferences').upsert(
        {
            user_id: user.id,
            notify_spending_enabled: true,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
    );

    const timezone =
        typeof body.timezone === 'string' && body.timezone.trim()
            ? body.timezone.trim()
            : 'America/New_York';

    await supabase.from('habit_notification_preferences').upsert(
        {
            user_id: user.id,
            notify_habits_enabled: true,
            notify_priorities_enabled: true,
            notify_todos_enabled: true,
            notify_morning_score_enabled: true,
            notify_afternoon_score_enabled: true,
            notify_evening_score_enabled: true,
            notify_plan_tomorrow_enabled: true,
            timezone,
            habit_reminder_times: ['08:00', '14:00', '20:00'],
            priorities_reminder_times: ['07:30'],
            todos_reminder_times: ['09:00', '18:00'],
            morning_score_time: '12:00',
            afternoon_score_time: '17:00',
            evening_score_time: '21:00',
            plan_tomorrow_time: '20:30',
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
    );

    return NextResponse.json({ success: true });
}
