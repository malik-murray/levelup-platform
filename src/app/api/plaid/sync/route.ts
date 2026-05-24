import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registerPlaidItemWebhook } from '@/lib/plaid/registerPlaidItemWebhook';
import { syncPlaidTransactionsForItem } from '@/lib/plaid/syncPlaidTransactionsForItem';

/**
 * Sync accounts and transactions from Plaid (user-initiated).
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

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
            auth: {
                persistSession: false,
            },
        });

        const body = await request.json();
        const { plaid_item_id } = body;

        if (!plaid_item_id) {
            return NextResponse.json({ error: 'plaid_item_id is required' }, { status: 400 });
        }

        const { data: plaidItem, error: itemError } = await supabase
            .from('plaid_items')
            .select('id, access_token')
            .eq('id', plaid_item_id)
            .eq('user_id', user.id)
            .single();

        if (itemError || !plaidItem) {
            return NextResponse.json({ error: 'Plaid item not found' }, { status: 404 });
        }

        const webhookReg = await registerPlaidItemWebhook(plaidItem.access_token);

        const result = await syncPlaidTransactionsForItem({
            supabase,
            plaidItemId: plaidItem.id,
            userId: user.id,
        });

        return NextResponse.json({
            success: true,
            webhook_registered: webhookReg.ok,
            skipped: result.skipped ?? false,
            accounts_synced: result.accounts_synced,
            transactions_synced: result.transactions_added,
            transactions_modified: result.transactions_modified,
            transactions_removed: result.transactions_removed,
            pending_inserted: result.pending_inserted,
            pending_merged_to_posted: result.pending_merged_to_posted,
            notifications_sent: result.notifications_sent,
            transfer_pairs_linked: result.transfer_pairs_linked,
            transfer_rows_category_fixed: result.transfer_rows_category_fixed,
            message: result.skipped
                ? 'Sync already in progress'
                : `Synced ${result.accounts_synced} accounts; ${result.transactions_added} new transaction(s)`,
        });
    } catch (error) {
        console.error('Error syncing from Plaid:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Failed to sync from Plaid' },
                { status: 500 }
            );
        }

        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
}
