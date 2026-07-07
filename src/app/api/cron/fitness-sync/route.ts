import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest, isCronConfigured } from '@/lib/cron/authorizeCronRequest';
import { getServiceRoleSupabase } from '@/lib/auth/getAuthenticatedUser';
import { runFitbitCronSync } from '@/lib/fitbit/runFitbitCronSync';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Background Fitbit sync for all connected users.
 */
export async function GET(request: NextRequest) {
    if (!isCronConfigured()) {
        return NextResponse.json(
            { error: 'CRON_SECRET is not set on the server.' },
            { status: 503 }
        );
    }

    if (!authorizeCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = getServiceRoleSupabase();
        const summary = await runFitbitCronSync(supabase);

        console.info('[fitness-cron] finished', {
            ...summary,
            triggered_by: request.headers.get('x-vercel-cron') ? 'vercel' : 'external',
        });

        return NextResponse.json({
            ok: true,
            mode: 'server_background',
            ...summary,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Fitness cron sync failed';
        console.error('[fitness-cron]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
