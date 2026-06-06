import { NextRequest, NextResponse } from 'next/server';
import { getHabitReminderDiagnostics } from '@/lib/habit/habitReminderDiagnostics';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader!.replace('Bearer ', '').trim();
    const supabase = supabaseForUser(token);

    const diagnostics = await getHabitReminderDiagnostics(supabase, user.id);

    return NextResponse.json(diagnostics);
}
