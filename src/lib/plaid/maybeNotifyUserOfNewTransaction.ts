import type { SupabaseClient } from '@supabase/supabase-js';
import {
    canonicalNotificationTransactionId,
    isSpendingAmount,
    normalizeMerchantLabel,
    spendNotificationIdempotencyKey,
} from '@/lib/plaid/plaidTransactionUtils';
import { getQuickCategoryActionsForPush } from '@/lib/push/getQuickCategoryActionsForPush';
import { createNotificationActionToken } from '@/lib/push/notificationActionToken';
import { sendFinanceSpendPush } from '@/lib/plaid/sendFinancePushNotification';
import { getRemainingBudgetForCategory } from '@/lib/financial-concierge/budgetEngine';
import {
    isPlainTransferCategory,
    isSavingsInvestingBucket,
    resolveStickyBudgetAmounts,
} from '@/lib/budgetOverview';

export type TransactionForNotification = {
    id: string;
    user_id: string;
    amount: number;
    name: string | null;
    note: string | null;
    date?: string | null;
    pending: boolean;
    notified_at: string | null;
    plaid_transaction_id: string | null;
    original_pending_transaction_id: string | null;
    category_id?: string | null;
};

export type NotifyResult = {
    notified: boolean;
    skippedReason?: string;
};

type BudgetCategoryRef = {
    id: string;
    type: string | null;
    name: string;
};

async function getRemainingPlanBalanceForMonth(
    supabase: SupabaseClient,
    userId: string,
    month: string
): Promise<number | null> {
    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const nextMonthStart = new Date(Date.UTC(year, monthNum, 1)).toISOString().split('T')[0];

    const [{ data: categories }, { data: budgets }, { data: transactions }] = await Promise.all([
        supabase
            .from('categories')
            .select('id, type, name')
            .eq('user_id', userId)
            .eq('kind', 'category')
            .eq('is_archived', false),
        supabase
            .from('category_budgets')
            .select('category_id, month, amount')
            .eq('user_id', userId),
        supabase
            .from('transactions')
            .select('category_id, amount')
            .eq('user_id', userId)
            .gte('date', monthStart)
            .lt('date', nextMonthStart)
            .is('removed_at', null),
    ]);

    const categoryList = (categories as BudgetCategoryRef[] | null) ?? [];
    if (categoryList.length === 0) return null;

    const categoryById = new Map(categoryList.map((c) => [c.id, c] as const));
    const stickyBudgets = resolveStickyBudgetAmounts(
        ((budgets as Array<{ category_id: string; month: string; amount: number }> | null) ?? []).filter(
            (b) => b.month <= month
        )
    );

    // Match Financial Plan totals semantics: include non-income categories.
    const totalAssigned = categoryList
        .filter((c) => c.type !== 'income')
        .reduce((sum, c) => sum + Math.abs(stickyBudgets.get(c.id) ?? 0), 0);

    let totalActivity = 0;
    for (const tx of ((transactions as Array<{ category_id: string | null; amount: number }> | null) ?? [])) {
        if (!tx.category_id) continue;
        const cat = categoryById.get(tx.category_id);
        if (!cat || cat.type === 'income') continue;

        // For spend/transfer-like buckets, activity is month outflow.
        if (
            isSavingsInvestingBucket(cat.type, cat.name) ||
            isPlainTransferCategory(cat.type, cat.name) ||
            cat.type === 'expense'
        ) {
            totalActivity += Math.abs(Math.min(0, Number(tx.amount) || 0));
            continue;
        }

        totalActivity += Math.abs(Number(tx.amount) || 0);
    }

    return totalAssigned - totalActivity;
}

/**
 * Notify user of new spending (pending or posted). Idempotent via notified_at + notification_events.
 */
export async function maybeNotifyUserOfNewTransaction(
    supabase: SupabaseClient,
    transaction: TransactionForNotification
): Promise<NotifyResult> {
    if (transaction.notified_at) {
        return { notified: false, skippedReason: 'already_notified' };
    }

    if (!isSpendingAmount(transaction.amount)) {
        return { notified: false, skippedReason: 'not_spending' };
    }

    const canonicalId = canonicalNotificationTransactionId({
        original_pending_transaction_id: transaction.original_pending_transaction_id,
        plaid_transaction_id: transaction.plaid_transaction_id,
    });
    if (!canonicalId) {
        return { notified: false, skippedReason: 'missing_canonical_id' };
    }

    const { data: prefs } = await supabase
        .from('finance_notification_preferences')
        .select('notify_spending_enabled, min_spending_amount')
        .eq('user_id', transaction.user_id)
        .maybeSingle();

    const notifyEnabled = prefs?.notify_spending_enabled ?? true;
    const minAmount = Number(prefs?.min_spending_amount ?? 0);
    if (!notifyEnabled) {
        return { notified: false, skippedReason: 'preferences_disabled' };
    }

    const spendAbs = Math.abs(transaction.amount);
    if (spendAbs <= minAmount) {
        return { notified: false, skippedReason: 'below_min_amount' };
    }

    const idempotencyKey = spendNotificationIdempotencyKey(transaction.user_id, canonicalId);

    const { data: existingEvent } = await supabase
        .from('notification_events')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

    if (existingEvent) {
        await supabase
            .from('transactions')
            .update({ notified_at: new Date().toISOString() })
            .eq('id', transaction.id);
        return { notified: false, skippedReason: 'idempotency_event_exists' };
    }

    const merchant = normalizeMerchantLabel(transaction.name, transaction.note);
    const title = 'New Transaction';
    const dateSuffix =
        transaction.date && /^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
            ? (() => {
                  const [y, m, d] = transaction.date.split('-');
                  // e.g. 2026-08-06 -> (8/6/26)
                  const yy = y.slice(2);
                  return ` (${parseInt(m, 10)}/${parseInt(d, 10)}/${yy})`;
              })()
            : '';

    let remainingSuffix = '';
    let planSuffix = '';
    const month =
        transaction.date && /^\d{4}-\d{2}/.test(transaction.date)
            ? transaction.date.slice(0, 7)
            : new Date().toISOString().slice(0, 7);

    if (transaction.category_id) {
        try {
            const remaining = await getRemainingBudgetForCategory(
                supabase,
                transaction.user_id,
                transaction.category_id,
                month
            );
            if (remaining) {
                remainingSuffix =
                    remaining.remaining >= 0
                        ? ` — $${remaining.remaining.toFixed(2)} left in ${remaining.categoryName}`
                        : ` — $${Math.abs(remaining.remaining).toFixed(2)} over ${remaining.categoryName}`;
            }
        } catch (err) {
            console.error('getRemainingBudgetForCategory failed:', err);
        }
    }

    try {
        const planRemaining = await getRemainingPlanBalanceForMonth(
            supabase,
            transaction.user_id,
            month
        );
        if (planRemaining != null) {
            planSuffix =
                planRemaining >= 0
                    ? ` • Plan: $${planRemaining.toFixed(2)} left`
                    : ` • Plan: $${Math.abs(planRemaining).toFixed(2)} over`;
        }
    } catch (err) {
        console.error('getRemainingPlanBalanceForMonth failed:', err);
    }

    const body = `$${spendAbs.toFixed(2)} at ${merchant}${dateSuffix}${remainingSuffix}${planSuffix}`;

    const [quickCategories, actionToken] = await Promise.all([
        getQuickCategoryActionsForPush(supabase, transaction.user_id, transaction.category_id ?? null),
        createNotificationActionToken({
            userId: transaction.user_id,
            transactionId: transaction.id,
        }),
    ]);

    const { error: eventError } = await supabase.from('notification_events').insert({
        user_id: transaction.user_id,
        transaction_id: transaction.id,
        idempotency_key: idempotencyKey,
        channel: 'push',
        title,
        body,
        payload: {
            transaction_id: transaction.id,
            pending: transaction.pending,
            canonical_transaction_id: canonicalId,
        },
        delivery_status: 'pending',
    });

    if (eventError) {
        if (eventError.code === '23505') {
            return { notified: false, skippedReason: 'idempotency_race' };
        }
        console.error('notification_events insert failed:', eventError.message);
        return { notified: false, skippedReason: 'event_insert_failed' };
    }

    const pushResult = await sendFinanceSpendPush(supabase, {
        userId: transaction.user_id,
        title,
        body,
        data: {
            transactionId: transaction.id,
            url: `/finance/categorize/${transaction.id}`,
            merchant,
            amount: String(transaction.amount),
            pending: transaction.pending ? '1' : '0',
            actionToken: actionToken ?? '',
            quickCategories: JSON.stringify(quickCategories),
        },
    });

    await supabase
        .from('notification_events')
        .update({
            delivery_status: pushResult.sent ? 'sent' : pushResult.skipped ? 'skipped' : 'failed',
            delivery_error: pushResult.error ?? null,
        })
        .eq('idempotency_key', idempotencyKey);

    await supabase
        .from('transactions')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', transaction.id);

    return { notified: pushResult.sent || pushResult.skipped };
}
