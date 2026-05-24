import { NextRequest, NextResponse } from 'next/server';
import { sendFinanceSpendPush } from '@/lib/plaid/sendFinancePushNotification';
import { isWebPushConfigured } from '@/lib/push/webPushServer';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';

/**
 * POST /api/push/test — send a test spend banner to the current user's devices.
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
                error: 'No push subscription found. Enable Spend alerts in Settings first.',
            },
            { status: 400 }
        );
    }

    const result = await sendFinanceSpendPush(supabase, {
        userId: user.id,
        title: 'Test transaction detected',
        body: 'You spent $1.00 at Test Merchant (this is a test alert).',
        data: {
            transactionId: 'test',
            url: '/finance/transactions',
        },
    });

    if (result.sent) {
        return NextResponse.json({ success: true, message: 'Test notification sent.' });
    }

    return NextResponse.json(
        {
            success: false,
            skipped: result.skipped,
            error: result.error ?? 'Push was not delivered. Check server logs.',
        },
        { status: result.skipped ? 200 : 502 }
    );
}
