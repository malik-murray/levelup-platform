import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { plaidItemNeedsReauth } from '@/lib/plaid/plaidItemNeedsReauth';
import { syncPlaidTransactionsForItem } from '@/lib/plaid/syncPlaidTransactionsForItem';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorizeCron(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[plaid-cron] CRON_SECRET is not configured');
        return false;
    }
    return authHeader === `Bearer ${cronSecret}`;
}

async function runPlaidBackupSync() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });

    const { data: items, error } = await supabase
        .from('plaid_items')
        .select('id, user_id, item_id, institution_name, error_code')
        .order('last_successful_update', { ascending: true, nullsFirst: true });

    if (error) {
        throw new Error(`Failed to list plaid_items: ${error.message}`);
    }

    const results: Array<{
        plaid_item_id: string;
        item_id: string;
        success: boolean;
        error?: string;
        transactions_added?: number;
    }> = [];

    for (const item of items ?? []) {
        if (plaidItemNeedsReauth(item.error_code as string | null)) {
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                success: false,
                error: `skipped:${item.error_code}`,
            });
            continue;
        }

        try {
            const syncResult = await syncPlaidTransactionsForItem({
                supabase,
                plaidItemId: item.id,
                userId: item.user_id as string,
            });
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                success: true,
                transactions_added: syncResult.transactions_added,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            console.error('[plaid-cron] item sync failed', {
                plaid_item_id: item.id,
                item_id: item.item_id,
                message,
            });
            results.push({
                plaid_item_id: item.id,
                item_id: item.item_id,
                success: false,
                error: message,
            });
        }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.info('[plaid-cron] backup sync finished', {
        total: results.length,
        succeeded,
        failed,
    });

    return { total: results.length, succeeded, failed, results };
}

/**
 * Scheduled backup Plaid sync (every 4–12 hours via Vercel cron).
 * Auth: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
    if (!authorizeCron(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const summary = await runPlaidBackupSync();
        return NextResponse.json({ ok: true, ...summary });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Cron sync failed';
        console.error('[plaid-cron]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
