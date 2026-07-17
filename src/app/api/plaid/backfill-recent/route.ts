import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { backfillRecentPlaidTransactionsForItem } from '@/lib/plaid/backfillRecentPlaidTransactionsForItem';
import { plaidItemNeedsReauth } from '@/lib/plaid/plaidItemNeedsReauth';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
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

        const body = (await request.json().catch(() => ({}))) as { days?: number };
        // Allow up to 730 days (Plaid's max) for a one-time deep backfill after re-linking.
        const days = Math.max(1, Math.min(Number(body.days ?? 14), 730));

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
        });

        const { data: items, error } = await supabase
            .from('plaid_items')
            .select('id, item_id, institution_name, error_code')
            .eq('user_id', user.id)
            .order('last_successful_update', { ascending: true, nullsFirst: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let added = 0;
        let fetched = 0;
        let skipped = 0;
        const results: Array<Record<string, unknown>> = [];

        for (const item of items ?? []) {
            if (plaidItemNeedsReauth(item.error_code as string | null)) {
                skipped += 1;
                results.push({
                    plaid_item_id: item.id,
                    item_id: item.item_id,
                    institution_name: item.institution_name,
                    success: false,
                    skipped: true,
                    error: item.error_code,
                });
                continue;
            }

            const res = await backfillRecentPlaidTransactionsForItem({
                supabase,
                plaidItemId: item.id,
                userId: user.id,
                days,
            });
            added += res.added;
            fetched += res.fetched;
            results.push({
                ...res,
                item_id: item.item_id,
                institution_name: item.institution_name,
            });
        }

        return NextResponse.json({
            success: true,
            days,
            items: (items ?? []).length,
            skipped,
            fetched,
            added,
            results,
            message:
                added > 0
                    ? `Backfilled ${added} transaction(s) from the last ${days} day(s).`
                    : `No new transactions found in the last ${days} day(s).`,
        });
    } catch (err) {
        console.error('[plaid-backfill-recent]', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Backfill failed' },
            { status: 500 }
        );
    }
}
