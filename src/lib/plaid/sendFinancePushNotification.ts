import type { SupabaseClient } from '@supabase/supabase-js';
import {
    sendUserPush,
    type PushPayload,
    type PushSendResult,
} from '@/lib/push/sendUserPushNotification';

export type { PushPayload, PushSendResult };

/** @deprecated Use sendUserPush — kept for finance call sites */
export async function sendFinanceSpendPush(
    supabase: SupabaseClient,
    payload: PushPayload
): Promise<PushSendResult> {
    return sendUserPush(supabase, payload);
}
