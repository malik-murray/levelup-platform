import { NextRequest, NextResponse } from 'next/server';
import { isWebPushConfigured } from '@/lib/push/webPushServer';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';
import { parseHabitReminderPrefsFromRow, prefsToApiResponse } from '@/lib/habit/habitReminderUtils';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader!.replace('Bearer ', '').trim();
    const supabase = supabaseForUser(token);

    const [{ data: subs }, { data: financePrefs }, { data: habitPrefs }] = await Promise.all([
        supabase
            .from('user_push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('platform', 'web')
            .limit(1),
        supabase
            .from('finance_notification_preferences')
            .select('notify_spending_enabled')
            .eq('user_id', user.id)
            .maybeSingle(),
        supabase.from('habit_notification_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    const habit = prefsToApiResponse(parseHabitReminderPrefsFromRow(user.id, habitPrefs));

    return NextResponse.json({
        serverConfigured: isWebPushConfigured(),
        subscribed: (subs?.length ?? 0) > 0,
        notifySpendingEnabled: financePrefs?.notify_spending_enabled ?? true,
        ...habit,
        vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? null,
    });
}
