import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemovedTransaction, Transaction } from 'plaid';
import {
    categorizeTransaction,
    categorizeTransactionsBatch,
    type TransactionToCategorize,
} from '@/lib/financial-concierge/categoryEngine';
import {
    findConfidentPendingMatch,
    mapPlaidAmount,
    parsePlaidDatetime,
    snapshotPlaidPfc,
} from '@/lib/plaid/plaidTransactionUtils';
import {
    maybeNotifyUserOfNewTransaction,
    type TransactionForNotification,
} from '@/lib/plaid/maybeNotifyUserOfNewTransaction';

export type PlaidSyncStats = {
    added: number;
    modified: number;
    removed: number;
    pending_inserted: number;
    pending_merged_to_posted: number;
    duplicate_posted_skipped: number;
    notifications_sent: number;
};

export type PlaidAccountIdMap = Map<string, string>;

type DbTxRow = {
    id: string;
    user_id: string;
    account_id: string | null;
    plaid_transaction_id: string | null;
    pending: boolean;
    pending_transaction_id: string | null;
    original_pending_transaction_id: string | null;
    notified_at: string | null;
    amount: number;
    date: string;
    name: string | null;
    note: string | null;
    removed_at: string | null;
};

function emptyStats(): PlaidSyncStats {
    return {
        added: 0,
        modified: 0,
        removed: 0,
        pending_inserted: 0,
        pending_merged_to_posted: 0,
        duplicate_posted_skipped: 0,
        notifications_sent: 0,
    };
}

function mapPlaidAccountType(
    type: string,
    subtype: string | null
): 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other' {
    if (type === 'depository') {
        if (subtype === 'checking') return 'checking';
        if (subtype === 'savings') return 'savings';
        return 'checking';
    }
    if (type === 'credit') return 'credit';
    if (type === 'investment' || type === 'brokerage') return 'investment';
    return 'other';
}

export async function syncPlaidAccountsForItem(params: {
    supabase: SupabaseClient;
    userId: string;
    plaidItemDbId: string;
    accessToken: string;
    plaidClient: import('plaid').PlaidApi;
}): Promise<number> {
    const { supabase, userId, plaidItemDbId, accessToken, plaidClient } = params;
    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    let count = 0;

    for (const plaidAccount of accountsResponse.data.accounts) {
        const { data: existingAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('plaid_account_id', plaidAccount.account_id)
            .maybeSingle();

        const accountData = {
            name: plaidAccount.name,
            type: mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
            starting_balance: plaidAccount.balances.current || 0,
            plaid_account_id: plaidAccount.account_id,
            plaid_item_id: plaidItemDbId,
            user_id: userId,
        };

        if (existingAccount) {
            await supabase.from('accounts').update(accountData).eq('id', existingAccount.id);
        } else {
            const { error } = await supabase.from('accounts').insert(accountData);
            if (!error) count++;
        }
    }

    return accountsResponse.data.accounts.length;
}

export async function buildPlaidAccountIdMap(
    supabase: SupabaseClient,
    plaidItemDbId: string
): Promise<PlaidAccountIdMap> {
    const { data: accounts } = await supabase
        .from('accounts')
        .select('id, plaid_account_id')
        .eq('plaid_item_id', plaidItemDbId);

    const map = new Map<string, string>();
    for (const row of accounts ?? []) {
        if (row.plaid_account_id) {
            map.set(row.plaid_account_id, row.id);
        }
    }
    return map;
}

function buildRowFromPlaid(params: {
    plaidTransaction: Transaction;
    userId: string;
    accountId: string;
    plaidItemDbId: string;
    preserveNotifiedAt?: string | null;
    preserveOriginalPendingId?: string | null;
    existingId?: string;
}): Record<string, unknown> {
    const { plaidTransaction, userId, accountId, plaidItemDbId } = params;
    const amount = mapPlaidAmount(plaidTransaction.amount);
    const pfc = snapshotPlaidPfc(plaidTransaction);
    // Paying off a credit card (or a buy-now-pay-later plan) settles spend that already
    // happened when the card was swiped - it isn't new spend itself, regardless of whether
    // the card is connected in Plaid. Treat it like an internal transfer so it doesn't get
    // double-counted in budgets/insights.
    const isCardPayoff =
        pfc?.detailed === 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' || pfc?.detailed === 'LOAN_PAYMENTS_BNPL';
    // Plaid already tells us these are transfers (brokerage/investment account moves,
    // account-to-account transfers, etc.) via personal_finance_category.primary - the
    // categorizer already skips auto-labeling them (see SKIP_DETAILED_PREFIXES in
    // plaidPfcToLeafCategoryName.ts), but that signal never made it to is_transfer, so these
    // were being counted as real income/spend in budgets.
    const isPlaidTransfer = pfc?.primary === 'TRANSFER_IN' || pfc?.primary === 'TRANSFER_OUT';

    const originalPending =
        params.preserveOriginalPendingId ??
        (plaidTransaction.pending
            ? plaidTransaction.transaction_id
            : plaidTransaction.pending_transaction_id);

    const row: Record<string, unknown> = {
        user_id: userId,
        account_id: accountId,
        plaid_item_id: plaidItemDbId,
        plaid_transaction_id: plaidTransaction.transaction_id,
        pending_transaction_id: plaidTransaction.pending_transaction_id,
        original_pending_transaction_id: originalPending,
        date: plaidTransaction.date,
        transaction_datetime: parsePlaidDatetime(plaidTransaction),
        amount,
        name: plaidTransaction.name || null,
        note: plaidTransaction.merchant_name || null,
        person: 'Malik',
        pending: plaidTransaction.pending,
        iso_currency_code: plaidTransaction.iso_currency_code,
        payment_channel: plaidTransaction.payment_channel,
        plaid_category: plaidTransaction.category
            ? { category: plaidTransaction.category, category_id: plaidTransaction.category_id }
            : null,
        plaid_personal_finance_category: pfc,
        raw_plaid_transaction: plaidTransaction as unknown as Record<string, unknown>,
        synced_from_plaid: true,
        removed_at: null,
    };

    if (isCardPayoff || isPlaidTransfer) {
        row.is_transfer = true;
    }

    if (params.preserveNotifiedAt != null) {
        row.notified_at = params.preserveNotifiedAt;
    }

    return row;
}

async function loadTxByPlaidId(
    supabase: SupabaseClient,
    userId: string,
    plaidTransactionId: string
): Promise<DbTxRow | null> {
    const { data } = await supabase
        .from('transactions')
        .select(
            'id, user_id, account_id, plaid_transaction_id, pending, pending_transaction_id, original_pending_transaction_id, notified_at, amount, date, name, note, removed_at'
        )
        .eq('user_id', userId)
        .eq('plaid_transaction_id', plaidTransactionId)
        .maybeSingle();
    return (data as DbTxRow | null) ?? null;
}

async function loadPendingCandidatesForAccount(
    supabase: SupabaseClient,
    userId: string,
    accountId: string
): Promise<DbTxRow[]> {
    const { data } = await supabase
        .from('transactions')
        .select(
            'id, user_id, account_id, plaid_transaction_id, pending, pending_transaction_id, original_pending_transaction_id, notified_at, amount, date, name, note, removed_at'
        )
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('pending', true)
        .is('removed_at', null);
    return (data as DbTxRow[]) ?? [];
}

async function applyCategorization(
    supabase: SupabaseClient,
    userId: string,
    txId: string,
    plaidTransaction: Transaction
): Promise<void> {
    const amount = mapPlaidAmount(plaidTransaction.amount);
    await categorizeTransaction(
        {
            id: txId,
            name: plaidTransaction.name || null,
            note: plaidTransaction.merchant_name || null,
            amount,
            date: plaidTransaction.date,
            plaid_personal_finance_category: snapshotPlaidPfc(plaidTransaction),
        },
        { supabase, userId, persistToTransaction: true }
    );
}

/**
 * Durable safety net: categorize any still-uncategorized synced transactions for an item.
 * Ingest categorizes on insert, but the "modified" branch preserves the existing category
 * without re-running categorization — so a row Plaid modifies before it was ever categorized
 * (or any insert-time miss) can linger with no category, which quietly rots the budget
 * baseline. Running this after each sync keeps categorization durable. Idempotent: rows that
 * resolve drop out of future sweeps; the small residue with no usable Plaid label / rule is
 * retried cheaply. Capped so a huge initial backfill sweeps incrementally across syncs.
 */
export async function categorizeUncategorizedSyncedForItem(params: {
    supabase: SupabaseClient;
    userId: string;
    plaidItemDbId: string;
    limit?: number;
}): Promise<number> {
    const { supabase, userId, plaidItemDbId } = params;
    const limit = params.limit ?? 1000;

    const { data, error } = await supabase
        .from('transactions')
        .select('id, name, note, amount, date, plaid_personal_finance_category')
        .eq('user_id', userId)
        .eq('plaid_item_id', plaidItemDbId)
        .eq('synced_from_plaid', true)
        .is('category_id', null)
        .is('removed_at', null)
        .limit(limit);

    if (error || !data || data.length === 0) return 0;

    const toCategorize: TransactionToCategorize[] = data.map((row) => ({
        id: row.id as string,
        name: (row.name as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        amount: row.amount as number,
        date: row.date as string,
        plaid_personal_finance_category:
            (row.plaid_personal_finance_category as TransactionToCategorize['plaid_personal_finance_category']) ??
            null,
    }));

    const results = await categorizeTransactionsBatch(toCategorize, {
        supabase,
        userId,
        persistToTransaction: true,
    });

    let categorized = 0;
    for (const result of results.values()) {
        if (result?.category_id) categorized += 1;
    }
    return categorized;
}

async function notifyIfNeeded(
    supabase: SupabaseClient,
    row: TransactionForNotification,
    stats: PlaidSyncStats
): Promise<void> {
    const result = await maybeNotifyUserOfNewTransaction(supabase, row);
    if (result.notified) {
        stats.notifications_sent++;
    }
}

export async function processPlaidSyncBatch(params: {
    supabase: SupabaseClient;
    userId: string;
    plaidItemDbId: string;
    accountIdMap: PlaidAccountIdMap;
    added: Transaction[];
    modified: Transaction[];
    removed: RemovedTransaction[];
}): Promise<PlaidSyncStats> {
    const stats = emptyStats();
    const { supabase, userId, plaidItemDbId, accountIdMap } = params;

    for (const removed of params.removed) {
        const { error } = await supabase
            .from('transactions')
            .update({ removed_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('plaid_transaction_id', removed.transaction_id);
        if (!error) stats.removed++;
    }

    for (const plaidTx of params.modified) {
        const accountId = accountIdMap.get(plaidTx.account_id);
        if (!accountId) continue;

        const existing = await loadTxByPlaidId(supabase, userId, plaidTx.transaction_id);
        if (!existing) {
            await processAddedTransaction({
                supabase,
                userId,
                plaidItemDbId,
                accountId,
                plaidTransaction: plaidTx,
                stats,
                accountIdMap,
            });
            continue;
        }

        const row = buildRowFromPlaid({
            plaidTransaction: plaidTx,
            userId,
            accountId,
            plaidItemDbId,
            preserveNotifiedAt: existing.notified_at,
            preserveOriginalPendingId: existing.original_pending_transaction_id,
            existingId: existing.id,
        });
        delete row.category_id;
        const { error } = await supabase.from('transactions').update(row).eq('id', existing.id);
        if (!error) stats.modified++;
    }

    for (const plaidTx of params.added) {
        const accountId = accountIdMap.get(plaidTx.account_id);
        if (!accountId) continue;
        await processAddedTransaction({
            supabase,
            userId,
            plaidItemDbId,
            accountId,
            plaidTransaction: plaidTx,
            stats,
            accountIdMap,
        });
    }

    return stats;
}

async function processAddedTransaction(params: {
    supabase: SupabaseClient;
    userId: string;
    plaidItemDbId: string;
    accountId: string;
    plaidTransaction: Transaction;
    stats: PlaidSyncStats;
    accountIdMap: PlaidAccountIdMap;
}): Promise<void> {
    const { supabase, userId, plaidItemDbId, accountId, plaidTransaction, stats } = params;

    const existingById = await loadTxByPlaidId(
        supabase,
        userId,
        plaidTransaction.transaction_id
    );
    if (existingById && !existingById.removed_at) {
        const row = buildRowFromPlaid({
            plaidTransaction,
            userId,
            accountId,
            plaidItemDbId,
            preserveNotifiedAt: existingById.notified_at,
            preserveOriginalPendingId: existingById.original_pending_transaction_id,
            existingId: existingById.id,
        });
        delete row.category_id;
        await supabase.from('transactions').update(row).eq('id', existingById.id);
        stats.duplicate_posted_skipped++;
        return;
    }

    let mergeTarget: DbTxRow | null = null;

    if (!plaidTransaction.pending && plaidTransaction.pending_transaction_id) {
        mergeTarget = await loadTxByPlaidId(
            supabase,
            userId,
            plaidTransaction.pending_transaction_id
        );
    }

    if (!mergeTarget && !plaidTransaction.pending) {
        const candidates = await loadPendingCandidatesForAccount(supabase, userId, accountId);
        mergeTarget =
            findConfidentPendingMatch(
                {
                    accountId,
                    date: plaidTransaction.date,
                    amount: mapPlaidAmount(plaidTransaction.amount),
                    name: plaidTransaction.name,
                    merchantName: plaidTransaction.merchant_name ?? null,
                },
                candidates
            ) as DbTxRow | null;
    }

    if (mergeTarget) {
        const row = buildRowFromPlaid({
            plaidTransaction,
            userId,
            accountId,
            plaidItemDbId,
            preserveNotifiedAt: mergeTarget.notified_at,
            preserveOriginalPendingId:
                mergeTarget.original_pending_transaction_id ||
                mergeTarget.plaid_transaction_id,
            existingId: mergeTarget.id,
        });
        delete row.category_id;
        const { error } = await supabase.from('transactions').update(row).eq('id', mergeTarget.id);
        if (error) return;

        stats.pending_merged_to_posted++;
        stats.duplicate_posted_skipped++;
        await applyCategorization(supabase, userId, mergeTarget.id, plaidTransaction);
        return;
    }

    const insertRow = buildRowFromPlaid({
        plaidTransaction,
        userId,
        accountId,
        plaidItemDbId,
        preserveOriginalPendingId: plaidTransaction.pending
            ? plaidTransaction.transaction_id
            : plaidTransaction.pending_transaction_id,
    });
    delete insertRow.category_id;

    const { data: inserted, error } = await supabase
        .from('transactions')
        .insert(insertRow)
        .select(
            'id, user_id, amount, name, note, date, pending, notified_at, plaid_transaction_id, original_pending_transaction_id'
        )
        .single();

    if (error || !inserted) {
        if (error?.code === '23505') {
            stats.duplicate_posted_skipped++;
        }
        return;
    }

    stats.added++;
    if (plaidTransaction.pending) stats.pending_inserted++;

    await applyCategorization(supabase, userId, inserted.id, plaidTransaction);

    const { data: refreshed } = await supabase
        .from('transactions')
        .select('category_id')
        .eq('id', inserted.id)
        .maybeSingle();

    await notifyIfNeeded(
        supabase,
        {
            id: inserted.id,
            user_id: inserted.user_id,
            amount: inserted.amount,
            name: inserted.name,
            note: inserted.note,
            date: inserted.date as string | null,
            pending: inserted.pending,
            notified_at: inserted.notified_at,
            plaid_transaction_id: inserted.plaid_transaction_id,
            original_pending_transaction_id: inserted.original_pending_transaction_id,
            category_id: refreshed?.category_id ?? null,
        },
        stats
    );
}
