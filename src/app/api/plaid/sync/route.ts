import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Configuration, PlaidApi, PlaidEnvironments, TransactionsGetRequest } from 'plaid';

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

/**
 * Sync accounts and transactions from Plaid
 * This fetches the latest accounts and transactions from Plaid and updates the database
 */
export async function POST(request: NextRequest) {
    try {
        // Get user from Supabase session
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Get the authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json(
                { error: 'Authorization header required' },
                { status: 401 }
            );
        }

        // Extract token from "Bearer <token>"
        const token = authHeader.replace('Bearer ', '');
        
        // Verify the session
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { plaid_item_id } = body;

        if (!plaid_item_id) {
            return NextResponse.json(
                { error: 'plaid_item_id is required' },
                { status: 400 }
            );
        }

        // Get the Plaid item from database
        const { data: plaidItem, error: itemError } = await supabase
            .from('plaid_items')
            .select('*')
            .eq('id', plaid_item_id)
            .eq('user_id', user.id)
            .single();

        if (itemError || !plaidItem) {
            return NextResponse.json(
                { error: 'Plaid item not found' },
                { status: 404 }
            );
        }

        const accessToken = plaidItem.access_token;

        // Fetch accounts from Plaid
        const accountsResponse = await plaidClient.accountsGet({
            access_token: accessToken,
        });

        const plaidAccounts = accountsResponse.data.accounts;
        const accountsSynced: string[] = [];

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
            };

            if (existingAccount) {
                // Update existing account
                await supabase
                    .from('accounts')
                    .update(accountData)
                    .eq('id', existingAccount.id);
                accountsSynced.push(existingAccount.id);
            } else {
                // Create new account
                const { data: newAccount, error: accountError } = await supabase
                    .from('accounts')
                    .insert(accountData)
                    .select('id')
                    .single();

                if (!accountError && newAccount) {
                    accountsSynced.push(newAccount.id);
                }
            }
        }

        // Fetch transactions from Plaid (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

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
            // Plaid: positive = money out (expense), negative = money in (income)
            const amount = -plaidTransaction.amount; // Flip sign to match our convention

            // Insert transaction
            const { error: txError } = await supabase
                .from('transactions')
                .insert({
                    date: plaidTransaction.date,
                    amount,
                    name: plaidTransaction.name || null,
                    person: 'Malik', // Default
                    note: plaidTransaction.merchant_name || null,
                    account_id: account.id,
                    category_id: null, // Will need to be categorized later
                    plaid_transaction_id: plaidTransaction.transaction_id,
                    synced_from_plaid: true,
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
            .eq('id', plaid_item_id);

        return NextResponse.json({
            success: true,
            accounts_synced: accountsSynced.length,
            transactions_synced,
            transactions_skipped,
            message: `Synced ${accountsSynced.length} accounts and ${transactionsSynced} transactions`,
        });
    } catch (error) {
        console.error('Error syncing from Plaid:', error);
        
        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Failed to sync from Plaid' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

/**
 * Map Plaid account type to our account type
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

