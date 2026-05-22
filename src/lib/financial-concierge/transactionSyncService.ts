/**
 * TransactionSyncService - Server-side Plaid sync (scheduled / concierge API)
 * Uses SUPABASE_SERVICE_ROLE_KEY so RLS does not block plaid_items reads.
 */

import { createClient } from '@supabase/supabase-js';
import { syncPlaidTransactionsForItem } from '@/lib/plaid/syncPlaidTransactionsForItem';
import type { AuditActionType } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface SyncResult {
    success: boolean;
    accounts_synced: number;
    transactions_synced: number;
    transactions_skipped: number;
    errors?: string[];
}

export interface SyncOptions {
    userId?: string;
    plaidItemId?: string;
    dateRangeDays?: number;
    skipAuditLog?: boolean;
}

function getServiceSupabase() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        return null;
    }
    return createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });
}

async function logAuditEvent(
    userId: string,
    actionType: AuditActionType,
    actionDetails: Record<string, unknown>,
    resourceType?: string,
    resourceId?: string,
    ipAddress?: string,
    userAgent?: string
): Promise<void> {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
    const supabase = createClient(supabaseUrl, key, {
        auth: { persistSession: false },
    });

    await supabase.from('financial_audit_log').insert({
        user_id: userId,
        action_type: actionType,
        action_details: actionDetails,
        resource_type: resourceType,
        resource_id: resourceId,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
    });
}

/**
 * Syncs transactions for a user (all their Plaid items)
 */
export async function syncTransactionsForUser(
    userId: string,
    options: SyncOptions = {}
): Promise<SyncResult> {
    const supabase = getServiceSupabase();
    if (!supabase) {
        return {
            success: false,
            accounts_synced: 0,
            transactions_synced: 0,
            transactions_skipped: 0,
            errors: ['SUPABASE_SERVICE_ROLE_KEY is required for server-side Plaid sync'],
        };
    }

    const errors: string[] = [];

    try {
        let query = supabase.from('plaid_items').select('*').eq('user_id', userId);

        if (options.plaidItemId) {
            query = query.eq('id', options.plaidItemId);
        }

        const { data: plaidItems, error: itemsError } = await query;

        if (itemsError) {
            throw new Error(`Failed to fetch Plaid items: ${itemsError.message}`);
        }

        if (!plaidItems || plaidItems.length === 0) {
            return {
                success: true,
                accounts_synced: 0,
                transactions_synced: 0,
                transactions_skipped: 0,
                errors: ['No Plaid items found for user'],
            };
        }

        let totalAccountsSynced = 0;
        let totalTransactionsSynced = 0;
        let totalTransactionsSkipped = 0;

        for (const plaidItem of plaidItems) {
            try {
                const result = await syncPlaidTransactionsForItem({
                    supabase,
                    plaidItemId: plaidItem.id,
                    userId: plaidItem.user_id as string,
                });
                totalAccountsSynced += result.accounts_synced;
                totalTransactionsSynced += result.transactions_added;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to sync Plaid item ${plaidItem.id}: ${errorMessage}`);
                console.error(`Error syncing Plaid item ${plaidItem.id}:`, error);
            }
        }

        if (!options.skipAuditLog) {
            await logAuditEvent(
                userId,
                'transaction_sync',
                {
                    accounts_synced: totalAccountsSynced,
                    transactions_synced: totalTransactionsSynced,
                    transactions_skipped: 0,
                    plaid_items_count: plaidItems.length,
                },
                'plaid_item',
                options.plaidItemId || undefined
            );
        }

        return {
            success: errors.length === 0,
            accounts_synced: totalAccountsSynced,
            transactions_synced: totalTransactionsSynced,
            transactions_skipped: totalTransactionsSkipped,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error syncing transactions:', error);
        return {
            success: false,
            accounts_synced: 0,
            transactions_synced: 0,
            transactions_skipped: 0,
            errors: [errorMessage],
        };
    }
}

/**
 * Monthly sync job - syncs last 90 days for all active users
 */
export async function monthlySyncJob(): Promise<{ users_processed: number; errors: string[] }> {
    const supabase = getServiceSupabase();
    const errors: string[] = [];
    let usersProcessed = 0;

    if (!supabase) {
        return {
            users_processed: 0,
            errors: ['SUPABASE_SERVICE_ROLE_KEY is required for monthly Plaid sync'],
        };
    }

    try {
        const { data: plaidItems, error: itemsError } = await supabase
            .from('plaid_items')
            .select('user_id')
            .not('access_token', 'is', null);

        if (itemsError) {
            throw new Error(`Failed to fetch Plaid items: ${itemsError.message}`);
        }

        const userIds = [...new Set((plaidItems || []).map(item => item.user_id))];

        for (const userId of userIds) {
            try {
                const result = await syncTransactionsForUser(userId, {
                    skipAuditLog: false,
                });

                if (!result.success && result.errors) {
                    errors.push(...result.errors.map(e => `User ${userId}: ${e}`));
                }

                usersProcessed++;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`User ${userId}: ${errorMessage}`);
                console.error(`Error in monthly sync for user ${userId}:`, error);
            }
        }

        return { users_processed: usersProcessed, errors };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in monthly sync job:', error);
        return { users_processed: usersProcessed, errors: [errorMessage] };
    }
}
