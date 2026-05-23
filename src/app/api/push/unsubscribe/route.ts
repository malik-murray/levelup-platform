import { NextRequest, NextResponse } from 'next/server';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader!.replace('Bearer ', '').trim();
    const body = (await request.json()) as { endpoint?: string | null };
    const supabase = supabaseForUser(token);

    let query = supabase.from('user_push_subscriptions').delete().eq('user_id', user.id);
    if (body.endpoint) {
        query = query.eq('token', body.endpoint);
    }

    await query;

    await supabase.from('finance_notification_preferences').upsert(
        {
            user_id: user.id,
            notify_spending_enabled: false,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
    );

    return NextResponse.json({ success: true });
}
