import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { syncTransactionsForUser, SyncOptions } from '@/lib/financial-concierge/transactionSyncService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/financial-concierge/sync-transactions
 * Manually trigger transaction sync from Plaid
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const options: SyncOptions = {
            userId: user.id,
            plaidItemId: body.plaid_item_id || undefined,
            dateRangeDays: body.date_range_days || 30,
            skipAuditLog: false,
        };

        // Get IP and user agent for audit log
        const ipAddress = request.headers.get('x-forwarded-for') || 
                         request.headers.get('x-real-ip') || 
                         undefined;
        const userAgent = request.headers.get('user-agent') || undefined;

        const result = await syncTransactionsForUser(user.id, options);

        return NextResponse.json({
            success: result.success,
            accounts_synced: result.accounts_synced,
            transactions_synced: result.transactions_synced,
            transactions_skipped: result.transactions_skipped,
            errors: result.errors,
            message: result.success 
                ? `Synced ${result.transactions_synced} transactions` 
                : 'Sync completed with errors',
        });
    } catch (error) {
        console.error('Error syncing transactions:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync transactions' },
            { status: 500 }
        );
    }
}

