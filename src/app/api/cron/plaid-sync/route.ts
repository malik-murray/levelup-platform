import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCronRequest, isCronConfigured } from '@/lib/cron/authorizeCronRequest';
import { runPlaidCronSync } from '@/lib/plaid/runPlaidCronSync';
import { runHabitReminderCron } from '@/lib/habit/runHabitReminderCron';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Server-side Plaid sync — runs on a schedule even when the app is closed.
 * Vercel: set CRON_SECRET; schedule in vercel.json (e.g. every 10–15 minutes).
 * External fallback: curl with Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
    if (!isCronConfigured()) {
        return NextResponse.json(
            {
                error: 'CRON_SECRET is not set on the server. Background sync and push alerts while the app is closed will not run.',
            },
            { status: 503 }
        );
    }

    if (!authorizeCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json(
            { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
            { status: 503 }
        );
    }

    try {
        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
        });

        const summary = await runPlaidCronSync(supabase, { allowRefresh: true });
        const habitReminders = await runHabitReminderCron(supabase);

        console.info('[plaid-cron] finished', {
            ...summary,
            habit_reminders: habitReminders,
            triggered_by: request.headers.get('x-vercel-cron') ? 'vercel' : 'external',
        });

        return NextResponse.json({
            ok: true,
            mode: 'server_background',
            cron_configured: true,
            ...summary,
            habit_reminders: habitReminders,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Cron sync failed';
        console.error('[plaid-cron]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
