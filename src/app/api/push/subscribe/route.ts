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
    const body = (await request.json()) as { subscription?: WebPushSubscriptionJson };
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

    return NextResponse.json({ success: true });
}
