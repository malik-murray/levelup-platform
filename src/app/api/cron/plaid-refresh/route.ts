import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runPlaidCronSync } from '@/lib/plaid/runPlaidCronSync';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorizeCron(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[plaid-cron-refresh] CRON_SECRET is not configured');
        return false;
    }
    return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Every ~6 hours: request bank refresh (rate-limited) then sync — catches data Plaid has not pushed via webhook.
 */
export async function GET(request: NextRequest) {
    if (!authorizeCron(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
    }

    try {
        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
        });
        const summary = await runPlaidCronSync(supabase, { allowRefresh: true });
        console.info('[plaid-cron-refresh] finished', summary);
        return NextResponse.json({ ok: true, mode: 'refresh', ...summary });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Cron refresh failed';
        console.error('[plaid-cron-refresh]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
