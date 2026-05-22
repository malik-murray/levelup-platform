import type { SupabaseClient } from '@supabase/supabase-js';
import {
    canonicalNotificationTransactionId,
    isSpendingAmount,
    normalizeMerchantLabel,
    spendNotificationIdempotencyKey,
} from '@/lib/plaid/plaidTransactionUtils';
import { sendFinanceSpendPush } from '@/lib/plaid/sendFinancePushNotification';

export type TransactionForNotification = {
    id: string;
    user_id: string;
    amount: number;
    name: string | null;
    note: string | null;
    pending: boolean;
    notified_at: string | null;
    plaid_transaction_id: string | null;
    original_pending_transaction_id: string | null;
};

export type NotifyResult = {
    notified: boolean;
    skippedReason?: string;
};

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
    const title = 'New transaction detected';
    const body = `You spent $${spendAbs.toFixed(2)} at ${merchant}.`;

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
        data: { transactionId: transaction.id },
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
