import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest, isCronConfigured } from '@/lib/cron/authorizeCronRequest';
import { runNewsfeedIngestionIfStale } from '@/lib/newsfeed/runIngestionIfStale';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Scheduled newsfeed ingestion — fetches RSS articles and runs the intelligence graph.
 * Vercel: schedule every 30 minutes in vercel.json.
 */
export async function GET(request: NextRequest) {
    if (!isCronConfigured()) {
        return NextResponse.json(
            { error: 'CRON_SECRET is not set on the server. Newsfeed ingestion will not run in the background.' },
            { status: 503 }
        );
    }

    if (!authorizeCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
            { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
            { status: 503 }
        );
    }

    try {
        const outcome = await runNewsfeedIngestionIfStale();

        console.info('[newsfeed-ingest-cron] finished', {
            skipped: outcome.skipped,
            reason: outcome.reason,
            inserted: outcome.result?.insertedCount,
            triggered_by: request.headers.get('x-vercel-cron') ? 'vercel' : 'external',
        });

        return NextResponse.json({
            ok: true,
            cron_configured: true,
            ...outcome,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Newsfeed ingestion cron failed';
        console.error('[newsfeed-ingest-cron]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
