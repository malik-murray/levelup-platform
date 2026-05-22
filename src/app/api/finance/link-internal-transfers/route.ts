import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { linkInternalTransferPairsForUser } from '@/lib/financial-concierge/linkInternalTransferPairs';

export const maxDuration = 60;

/**
 * POST /api/finance/link-internal-transfers
 * Links same-day, opposite-sign, equal-magnitude transactions on different accounts into transfer
 * groups, assigns the Transfer category, and aligns existing `is_transfer` rows to that category.
 *
 * Body (optional JSON):
 * - since_days: lookback window in days (default 730, min 30, max 3650)
 */
export async function POST(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const {
        data: { user },
        error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` },
        },
        auth: { persistSession: false },
    });

    let sinceDays = 730;
    try {
        const body = await request.json();
        if (typeof body.since_days === 'number' && Number.isFinite(body.since_days)) {
            sinceDays = Math.min(Math.max(Math.floor(body.since_days), 30), 3650);
        }
    } catch {
        // empty body
    }

    const result = await linkInternalTransferPairsForUser(supabase, user.id, { sinceDays });

    return NextResponse.json({
        success: true,
        pairs_linked: result.pairsLinked,
        transfer_rows_category_fixed: result.transferRowsCategoryFixed,
    });
}
