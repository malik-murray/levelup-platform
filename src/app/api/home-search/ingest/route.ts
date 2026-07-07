import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '@/lib/auth/getAuthenticatedUser';
import { authorizeCronRequest, isCronConfigured } from '@/lib/cron/authorizeCronRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ingest endpoint for the daily home-search research task (run externally, not
 * by Vercel cron — see the "daily-home-search" scheduled task). It POSTs the
 * ranked listings it finds here once a day; this route just persists them.
 * Authorized the same way as Vercel cron: Authorization: Bearer {CRON_SECRET}
 * or x-cron-secret header (see authorizeCronRequest — it explicitly supports
 * "Vercel Cron or an external pinger").
 */

type IncomingListing = {
    buySignalScore?: number | null;
    buySignalRationale?: string | null;
    address: string;
    city: string;
    state: string;
    homeType?: 'townhouse' | 'single_family' | 'condo' | null;
    builtYear?: number | null;
    beds?: number | null;
    baths?: number | null;
    price: number;
    hoaMonthly?: number | null;
    estMonthly10pctDown?: number | null;
    estMonthlyWithDpa?: number | null;
    fitsBudget?: 'yes' | 'no' | 'tight' | null;
    sourceUrl?: string | null;
    sourceLabel?: string | null;
};

type IngestBody = {
    runDate?: string;
    ownerEmail?: string;
    listings: IncomingListing[];
    notes?: string;
};

const DEFAULT_OWNER_EMAIL = process.env.HOME_SEARCH_OWNER_EMAIL || 'malik.murray3@yahoo.com';

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

    if (!Array.isArray(body.listings)) {
        return NextResponse.json({ error: '"listings" must be an array' }, { status: 400 });
    }

    const runDate = body.runDate || new Date().toISOString().slice(0, 10);
    const ownerEmail = body.ownerEmail || DEFAULT_OWNER_EMAIL;

    const supabase = getServiceRoleSupabase();

    // No direct email lookup in the supabase-js admin API — page through listUsers().
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

    const rows = body.listings.map((l) => ({
        user_id: ownerUserId,
        run_date: runDate,
        buy_signal_score: l.buySignalScore ?? null,
        buy_signal_rationale: l.buySignalRationale ?? null,
        address: l.address,
        city: l.city,
        state: l.state,
        home_type: l.homeType ?? null,
        built_year: l.builtYear ?? null,
        beds: l.beds ?? null,
        baths: l.baths ?? null,
        price: l.price,
        hoa_monthly: l.hoaMonthly ?? null,
        est_monthly_10pct_down: l.estMonthly10pctDown ?? null,
        est_monthly_with_dpa: l.estMonthlyWithDpa ?? null,
        fits_budget: l.fitsBudget ?? null,
        source_url: l.sourceUrl ?? null,
        source_label: l.sourceLabel ?? null,
    }));

    if (rows.length > 0) {
        const { error: upsertError } = await supabase
            .from('home_search_listings')
            .upsert(rows, { onConflict: 'user_id,run_date,address' });

        if (upsertError) {
            return NextResponse.json({ error: `Failed to insert listings: ${upsertError.message}` }, { status: 500 });
        }
    }

    const { error: runError } = await supabase.from('home_search_runs').upsert(
        {
            user_id: ownerUserId,
            run_date: runDate,
            ran_at: new Date().toISOString(),
            listings_count: rows.length,
            notes: body.notes ?? null,
        },
        { onConflict: 'user_id,run_date' }
    );

    if (runError) {
        return NextResponse.json({ error: `Failed to log run: ${runError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, runDate, inserted: rows.length });
}
