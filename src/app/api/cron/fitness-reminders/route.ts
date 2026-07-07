import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCronRequest, isCronConfigured } from '@/lib/cron/authorizeCronRequest';
import { runFitnessReminderCron } from '@/lib/fitness/runFitnessReminderCron';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Scheduled fitness accountability reminders — nudges the user if today's
 * scheduled workout is still incomplete.
 * Vercel: schedule every 15 minutes in vercel.json.
 */
export async function GET(request: NextRequest) {
    if (!isCronConfigured()) {
        return NextResponse.json(
            {
                error: 'CRON_SECRET is not set on the server. Fitness reminders will not run in the background.',
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

        const summary = await runFitnessReminderCron(supabase);

        console.info('[fitness-reminders-cron] finished', {
            ...summary,
            triggered_by: request.headers.get('x-vercel-cron') ? 'vercel' : 'external',
        });

        return NextResponse.json({
            ok: true,
            mode: 'server_background',
            cron_configured: true,
            ...summary,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Fitness reminder cron failed';
        console.error('[fitness-reminders-cron]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
