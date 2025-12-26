/**
 * TransactionSyncService - Handles syncing transactions from Plaid
 * Supports both manual triggers and scheduled monthly jobs
 */

import { createClient } from '@supabase/supabase-js';
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsGetRequest } from 'plaid';
import { FinancialAuditLog, AuditActionType } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize Plaid client
const configuration = new Configuration({
    basePath: process.env.PLAID_ENV === 'production' 
        ? PlaidEnvironments.production 
        : PlaidEnvironments.sandbox,
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
            'PLAID-SECRET': process.env.PLAID_SECRET!,
        },
    },
});

const plaidClient = new PlaidApi(configuration);

export interface SyncResult {
    success: boolean;
    accounts_synced: number;
    transactions_synced: number;
    transactions_skipped: number;
    errors?: string[];
}

export interface SyncOptions {
    userId?: string; // If provided, only sync for this user
    plaidItemId?: string; // If provided, only sync this item
    dateRangeDays?: number; // Number of days to sync (default: 30, monthly: 90)
    skipAuditLog?: boolean; // Skip audit log (for internal calls)
}

/**
 * Maps Plaid account type to our account type
 */
function mapPlaidAccountType(
    type: string,
    subtype: string | null
): 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other' {
    if (type === 'depository') {
        if (subtype === 'checking') return 'checking';
        if (subtype === 'savings') return 'savings';
        return 'checking'; // Default for depository
    }
    if (type === 'credit') return 'credit';
    if (type === 'investment') return 'investment';
    if (type === 'brokerage') return 'investment';
    return 'other';
}

/**
 * Logs an audit event
 */
async function logAuditEvent(
    userId: string,
    actionType: AuditActionType,
    actionDetails: Record<string, any>,
    resourceType?: string,
    resourceId?: string,
    ipAddress?: string,
    userAgent?: string
): Promise<void> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
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
 * Syncs transactions for a single Plaid item
 */
async function syncPlaidItem(
    plaidItem: any,
    userId: string,
    dateRangeDays: number = 30
): Promise<{ accountsSynced: number; transactionsSynced: number; transactionsSkipped: number }> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const accessToken = plaidItem.access_token;

    // Fetch accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
    });

    const plaidAccounts = accountsResponse.data.accounts;
    let accountsSynced = 0;

    // Sync accounts to database
    for (const plaidAccount of plaidAccounts) {
        // Check if account already exists
        const { data: existingAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('plaid_account_id', plaidAccount.account_id)
            .single();

        const accountData = {
            name: plaidAccount.name,
            type: mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
            starting_balance: plaidAccount.balances.current || 0,
            plaid_account_id: plaidAccount.account_id,
            plaid_item_id: plaidItem.id,
            user_id: userId, // Ensure user_id is set
        };

        if (existingAccount) {
            // Update existing account
            await supabase
                .from('accounts')
                .update(accountData)
                .eq('id', existingAccount.id);
            accountsSynced++;
        } else {
            // Create new account
            const { data: newAccount, error: accountError } = await supabase
                .from('accounts')
                .insert(accountData)
                .select('id')
                .single();

            if (!accountError && newAccount) {
                accountsSynced++;
            }
        }
    }

    // Fetch transactions from Plaid
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRangeDays);

    const transactionsRequest: TransactionsGetRequest = {
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
    };

    const transactionsResponse = await plaidClient.transactionsGet(transactionsRequest);
    let transactions = transactionsResponse.data.transactions;

    // Paginate through all transactions if needed
    let totalTransactions = transactionsResponse.data.total_transactions;
    while (transactions.length < totalTransactions) {
        const paginatedRequest: TransactionsGetRequest = {
            access_token: accessToken,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            options: {
                offset: transactions.length,
            },
        };
        const paginatedResponse = await plaidClient.transactionsGet(paginatedRequest);
        transactions = transactions.concat(paginatedResponse.data.transactions);
        totalTransactions = paginatedResponse.data.total_transactions;
    }

    // Sync transactions to database
    let transactionsSynced = 0;
    let transactionsSkipped = 0;

    for (const plaidTransaction of transactions) {
        // Skip pending transactions
        if (plaidTransaction.pending) {
            continue;
        }

        // Get the account by plaid_account_id
        const { data: account } = await supabase
            .from('accounts')
            .select('id')
            .eq('plaid_account_id', plaidTransaction.account_id)
            .single();

        if (!account) {
            transactionsSkipped++;
            continue;
        }

        // Check if transaction already exists
        const { data: existingTransaction } = await supabase
            .from('transactions')
            .select('id')
            .eq('plaid_transaction_id', plaidTransaction.transaction_id)
            .single();

        if (existingTransaction) {
            transactionsSkipped++;
            continue;
        }

        // Determine amount (Plaid uses positive for debits, negative for credits)
        // Our convention: positive for income, negative for expenses
        const amount = -plaidTransaction.amount; // Flip sign to match our convention

        // Insert transaction
        const { error: txError } = await supabase
            .from('transactions')
            .insert({
                date: plaidTransaction.date,
                amount,
                name: plaidTransaction.name || null,
                person: 'System', // Default for imported transactions
                note: plaidTransaction.merchant_name || null,
                account_id: account.id,
                category_id: null, // Will need to be categorized later
                plaid_transaction_id: plaidTransaction.transaction_id,
                synced_from_plaid: true,
                user_id: userId, // Ensure user_id is set
            });

        if (!txError) {
            transactionsSynced++;
        }
    }

    // Update last_successful_update timestamp
    await supabase
        .from('plaid_items')
        .update({
            last_successful_update: new Date().toISOString(),
            error_code: null,
            error_message: null,
        })
        .eq('id', plaidItem.id);

    return { accountsSynced, transactionsSynced, transactionsSkipped };
}

/**
 * Syncs transactions for a user (all their Plaid items)
 */
export async function syncTransactionsForUser(
    userId: string,
    options: SyncOptions = {}
): Promise<SyncResult> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const dateRangeDays = options.dateRangeDays ?? 30;
    const errors: string[] = [];

    try {
        // Get all Plaid items for this user
        let query = supabase
            .from('plaid_items')
            .select('*')
            .eq('user_id', userId);

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

        // Sync each Plaid item
        for (const plaidItem of plaidItems) {
            try {
                const result = await syncPlaidItem(plaidItem, userId, dateRangeDays);
                totalAccountsSynced += result.accountsSynced;
                totalTransactionsSynced += result.transactionsSynced;
                totalTransactionsSkipped += result.transactionsSkipped;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to sync Plaid item ${plaidItem.id}: ${errorMessage}`);
                console.error(`Error syncing Plaid item ${plaidItem.id}:`, error);
            }
        }

        // Log audit event
        if (!options.skipAuditLog) {
            await logAuditEvent(
                userId,
                'transaction_sync',
                {
                    accounts_synced: totalAccountsSynced,
                    transactions_synced: totalTransactionsSynced,
                    transactions_skipped: totalTransactionsSkipped,
                    date_range_days: dateRangeDays,
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const errors: string[] = [];
    let usersProcessed = 0;

    try {
        // Get all users with Plaid items
        const { data: plaidItems, error: itemsError } = await supabase
            .from('plaid_items')
            .select('user_id')
            .not('access_token', 'is', null);

        if (itemsError) {
            throw new Error(`Failed to fetch Plaid items: ${itemsError.message}`);
        }

        // Get unique user IDs
        const userIds = [...new Set((plaidItems || []).map(item => item.user_id))];

        // Sync for each user
        for (const userId of userIds) {
            try {
                const result = await syncTransactionsForUser(userId, {
                    dateRangeDays: 90, // Monthly job syncs 90 days
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



