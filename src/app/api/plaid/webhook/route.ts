import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlaidApi } from '@/lib/plaid/plaidApi';
import { syncPlaidTransactionsForItem } from '@/lib/plaid/syncPlaidTransactionsForItem';
import { verifyPlaidWebhook } from '@/lib/plaid/verifyPlaidWebhook';

export const runtime = 'nodejs';

/**
 * Plaid webhooks: respond immediately, run sync in background via after().
 * Configure PLAID_WEBHOOK_URL and SUPABASE_SERVICE_ROLE_KEY in production.
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const plaidClient = getPlaidApi();

    const verificationHeader =
        request.headers.get('Plaid-Verification') ?? request.headers.get('plaid-verification');

    const skipVerify = process.env.PLAID_SKIP_WEBHOOK_VERIFY === '1';
    if (!skipVerify) {
        if (!verificationHeader) {
            return NextResponse.json({ error: 'Missing Plaid-Verification header' }, { status: 400 });
        }
        const valid = await verifyPlaidWebhook(rawBody, verificationHeader, plaidClient);
        if (!valid) {
            return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
        }
    }

    let body: {
        webhook_type?: string;
        webhook_code?: string;
        item_id?: string;
        environment?: string;
    };
    try {
        body = JSON.parse(rawBody) as typeof body;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    console.info('[plaid-webhook] received', {
        webhook_type: body.webhook_type,
        webhook_code: body.webhook_code,
        item_id: body.item_id,
        environment: body.environment,
    });

    if (body.webhook_type !== 'TRANSACTIONS' || body.webhook_code !== 'SYNC_UPDATES_AVAILABLE') {
        return NextResponse.json({ received: true });
    }

    if (!body.item_id) {
        return NextResponse.json({ error: 'Missing item_id' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        console.error('[plaid-webhook] missing Supabase service configuration');
        return NextResponse.json({ error: 'Server not configured for webhooks' }, { status: 503 });
    }

    const itemId = body.item_id;

    after(async () => {
        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
        });

        const { data: plaidItem, error } = await supabase
            .from('plaid_items')
            .select('id, user_id')
            .eq('item_id', itemId)
            .maybeSingle();

        if (error) {
            console.error('[plaid-webhook] plaid_items lookup error', {
                item_id: itemId,
                message: error.message,
            });
            return;
        }

        if (!plaidItem?.id || !plaidItem.user_id) {
            console.warn('[plaid-webhook] unknown plaid item_id — ignoring', { item_id: itemId });
            return;
        }

        try {
            await syncPlaidTransactionsForItem({
                supabase,
                plaidItemId: plaidItem.id,
                userId: plaidItem.user_id as string,
            });
        } catch (err) {
            console.error('[plaid-webhook] background sync failed', {
                item_id: itemId,
                plaid_item_id: plaidItem.id,
                message: err instanceof Error ? err.message : 'unknown',
            });
        }
    });

    return NextResponse.json({ received: true });
}
