import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncAllPlaidItemsForUser } from '@/lib/plaid/syncAllPlaidItemsForUser';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * Sync all of the user's Plaid items (and re-register webhooks).
 * Called on Finance app open as a reliable fallback when webhooks/cron lag.
 */
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

        const body = (await request.json().catch(() => ({}))) as {
            register_webhooks?: boolean;
            request_refresh?: boolean;
        };

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false },
        });

        const summary = await syncAllPlaidItemsForUser({
            supabase,
            userId: user.id,
            registerWebhooks: body.register_webhooks !== false,
            requestRefresh: body.request_refresh === true,
        });

        console.info('[plaid-sync-all] finished', {
            user_id: user.id,
            total: summary.total,
            synced: summary.synced,
            skipped: summary.skipped,
            failed: summary.failed,
            webhooks_registered: summary.webhooks_registered,
            transactions_added: summary.transactions_added,
            pending_inserted: summary.pending_inserted,
        });

        return NextResponse.json({
            success: summary.failed === 0,
            ...summary,
            message:
                summary.transactions_added > 0
                    ? `Imported ${summary.transactions_added} new transaction(s)${
                          summary.pending_inserted > 0
                              ? ` (${summary.pending_inserted} pending)`
                              : ''
                      }`
                    : summary.pending_inserted > 0
                      ? `Imported ${summary.pending_inserted} pending transaction(s).`
                      : 'Accounts are up to date',
        });
    } catch (error) {
        console.error('[plaid-sync-all]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Sync failed' },
            { status: 500 }
        );
    }
}
