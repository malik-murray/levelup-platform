import { NextRequest, NextResponse } from 'next/server';
import { getHabitReminderDiagnostics } from '@/lib/habit/habitReminderDiagnostics';
import { getDisplayFirstName } from '@/lib/habit/habitNotificationCopy';
import { runHabitRemindersForUser } from '@/lib/habit/runHabitReminderCron';
import { getUserFromBearer, supabaseForUser } from '@/lib/push/pushApiAuth';

/**
 * POST /api/push/habit-reminders/run
 * Runs the scheduled reminder check for the current user.
 * Body: { force?: boolean } — force bypasses the time window (for testing).
 */
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const user = await getUserFromBearer(authHeader);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { force?: boolean; habitsOnly?: boolean };
    const force = body.force === true;
    const habitsOnly = body.habitsOnly !== false && force;

    const token = authHeader!.replace('Bearer ', '').trim();
    const supabase = supabaseForUser(token);

    const [diagnostics, summary] = await Promise.all([
        getHabitReminderDiagnostics(supabase, user.id),
        runHabitRemindersForUser(supabase, user.id, {
            ignoreTimeWindow: force,
            habitsOnly,
            firstName: getDisplayFirstName(user.user_metadata),
            forceIdempotencySuffix: force ? `manual-${Date.now()}` : undefined,
        }),
    ]);

    return NextResponse.json({
        diagnostics,
        summary,
        message:
            summary.reminders_sent > 0
                ? 'Reminder sent.'
                : summary.reminders_skipped > 0
                  ? force
                      ? 'Nothing to send (already notified or all habits complete).'
                      : 'Scheduled check ran — no reminder due right now.'
                  : summary.errors.length > 0
                    ? summary.errors.join('; ')
                    : 'Scheduled check ran — no reminder due right now.',
    });
}
