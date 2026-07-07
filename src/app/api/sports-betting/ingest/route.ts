import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '@/lib/auth/getAuthenticatedUser';
import { authorizeCronRequest, isCronConfigured } from '@/lib/cron/authorizeCronRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ingest endpoint for the daily sports-betting-bot pipeline (run externally via
 * a macOS LaunchAgent, not Vercel cron — see sports-betting-bot/push_to_platform.py).
 * It POSTs the day's ranked bets (plus any newly-graded results) here once a day;
 * this route just persists them. Authorized the same way as Vercel cron:
 * Authorization: Bearer {CRON_SECRET} or x-cron-secret header.
 */

type IncomingBet = {
    loggedAt: string;
    matchDate: string;
    competition: string;
    homeTeam: string;
    awayTeam: string;
    market: 'h2h' | 'totals_2.5' | 'btts';
    selection: string;
    modelProb: number;
    primaryBook: string;
    primaryPrice?: number | null;
    primaryEdge?: number | null;
    bestBook?: string | null;
    bestPrice?: number | null;
    bestEdge?: number | null;
    confidence: string;
    result?: 'win' | 'loss' | null;
};

type IngestBody = {
    runDate?: string;
    ownerEmail?: string;
    bets: IncomingBet[];
    notes?: string;
};

const DEFAULT_OWNER_EMAIL = process.env.SPORTS_BETTING_OWNER_EMAIL || 'malik.murray3@yahoo.com';

export async function POST(request: NextRequest) {
    if (!isCronConfigured()) {
        return NextResponse.json({ error: 'CRON_SECRET is not set on the server.' }, { status: 503 });
    }

    if (!authorizeCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: IngestBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!Array.isArray(body.bets)) {
        return NextResponse.json({ error: '"bets" must be an array' }, { status: 400 });
    }

    const runDate = body.runDate || new Date().toISOString().slice(0, 10);
    const ownerEmail = body.ownerEmail || DEFAULT_OWNER_EMAIL;

    const supabase = getServiceRoleSupabase();

    // No direct email lookup in the supabase-js admin API -- page through listUsers().
    let ownerUserId: string | null = null;
    for (let page = 1; page <= 5 && !ownerUserId; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) {
            return NextResponse.json({ error: `Failed to resolve owner user: ${error.message}` }, { status: 500 });
        }
        const match = data.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
        if (match) ownerUserId = match.id;
        if (data.users.length < 200) break;
    }

    if (!ownerUserId) {
        return NextResponse.json({ error: `No user found for email ${ownerEmail}` }, { status: 404 });
    }

    const rows = body.bets.map((b) => ({
        user_id: ownerUserId,
        logged_at: b.loggedAt,
        match_date: b.matchDate,
        competition: b.competition,
        home_team: b.homeTeam,
        away_team: b.awayTeam,
        market: b.market,
        selection: b.selection,
        model_prob: b.modelProb,
        primary_book: b.primaryBook,
        primary_price: b.primaryPrice ?? null,
        primary_edge: b.primaryEdge ?? null,
        best_book: b.bestBook ?? null,
        best_price: b.bestPrice ?? null,
        best_edge: b.bestEdge ?? null,
        confidence: b.confidence,
        result: b.result ?? null,
    }));

    if (rows.length > 0) {
        const { error: upsertError } = await supabase
            .from('sports_betting_bets')
            .upsert(rows, { onConflict: 'user_id,match_date,home_team,away_team,market,selection' });

        if (upsertError) {
            return NextResponse.json({ error: `Failed to insert bets: ${upsertError.message}` }, { status: 500 });
        }
    }

    const { error: runError } = await supabase.from('sports_betting_runs').upsert(
        {
            user_id: ownerUserId,
            run_date: runDate,
            ran_at: new Date().toISOString(),
            bets_count: rows.length,
            notes: body.notes ?? null,
        },
        { onConflict: 'user_id,run_date' }
    );

    if (runError) {
        return NextResponse.json({ error: `Failed to log run: ${runError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, runDate, inserted: rows.length });
}
