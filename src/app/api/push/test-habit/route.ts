import { NextRequest, NextResponse } from 'next/server';
import { sendUserPush } from '@/lib/push/sendUserPushNotification';
import { isWebPushConfigured } from '@/lib/push/webPushServer';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';

/**
 * POST /api/push/test-habit — send a test habit reminder to the current user's devices.
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isWebPushConfigured()) {
        return NextResponse.json(
            { error: 'Web Push is not configured (VAPID keys missing on server).' },
            { status: 503 }
        );
    }

    const token = authHeader!.replace('Bearer ', '').trim();
    const supabase = supabaseForUser(token);

    const { data: subs } = await supabase
        .from('user_push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'web')
        .limit(1);

    if (!subs?.length) {
        return NextResponse.json(
            {
                error: 'No push subscription found. Enable push notifications in Settings first.',
            },
            { status: 400 }
        );
    }

    const body = (await request.json().catch(() => ({}))) as { kind?: string };
    const kind = body.kind ?? 'priorities_setup';

    const samples: Record<string, { title: string; body: string; type: string }> = {
        priorities_setup: {
            title: 'Set your priorities',
            body: 'What are your top 3 priorities for today? (test alert)',
            type: 'priorities_reminder',
        },
        todos_setup: {
            title: 'Plan your day',
            body: 'Add your to-do list for today. (test alert)',
            type: 'todos_reminder',
        },
        todos_finish: {
            title: 'To-dos still open',
            body: 'You have 2 to-dos left: Email client, Workout (test alert)',
            type: 'todos_reminder',
        },
        habits_morning: {
            title: 'Morning habits',
            body: '3 habits left: 🏋️ Workout, 📖 Read, 🙏 Prayer (test alert)',
            type: 'habit_reminder',
        },
    };

    const sample = samples[kind] ?? samples.priorities_setup;

    const result = await sendUserPush(supabase, {
        userId: user.id,
        title: sample.title,
        body: sample.body,
        data: {
            type: sample.type,
            kind: `priorities_${Date.now()}`,
            category: 'priorities',
            url: '/dashboard',
            section: 'priorities',
        },
    });

    if (result.sent) {
        return NextResponse.json({ success: true, message: 'Test habit reminder sent.' });
    }

    return NextResponse.json(
        {
            success: false,
            skipped: result.skipped,
            error: result.error ?? 'Push was not delivered.',
        },
        { status: result.skipped ? 200 : 502 }
    );
}
