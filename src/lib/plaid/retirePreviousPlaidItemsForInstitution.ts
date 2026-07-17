import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type PreviousItemCandidate = {
    plaid_item_id: string;
    item_id: string | null;
    account_names: string[];
};

/**
 * Server-only service client (matches transactionSyncService).
 */
function getServiceClient(): SupabaseClient | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return null;
    return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * DETECTION-ONLY. Returns any prior Plaid items for the same (user_id, institution_id) so
 * the caller can surface them, WITHOUT modifying anything.
 *
 * History: an earlier version of this deleted "duplicate" items automatically on re-link.
 * That was unsafe — a user can legitimately hold several separate connections at one bank
 * (e.g. personal + business Navy Federal, same institution_id), and same-institution !=
 * same accounts. The auto-delete wiped legitimate connections' transactions. Item-level
 * dedup by institution alone cannot tell a true re-link (same real accounts, new ids) from
 * a distinct second membership, so we no longer delete here. Re-link dedup will be handled
 * account-by-account with explicit user confirmation instead.
 */
export async function detectPreviousPlaidItemsForInstitution(params: {
    userId: string;
    institutionId: string | null;
    keepPlaidItemDbId: string;
}): Promise<PreviousItemCandidate[]> {
    const { userId, institutionId, keepPlaidItemDbId } = params;
    if (!institutionId) return [];

    const supabase = getServiceClient();
    if (!supabase) return [];

    const { data: oldItems } = await supabase
        .from('plaid_items')
        .select('id, item_id')
        .eq('user_id', userId)
        .eq('institution_id', institutionId)
        .neq('id', keepPlaidItemDbId);

    if (!oldItems || oldItems.length === 0) return [];

    const candidates: PreviousItemCandidate[] = [];
    for (const item of oldItems) {
        const { data: accts } = await supabase
            .from('accounts')
            .select('name')
            .eq('plaid_item_id', item.id);
        candidates.push({
            plaid_item_id: item.id,
            item_id: (item.item_id as string) ?? null,
            account_names: (accts ?? []).map((a) => (a.name as string) ?? '?'),
        });
    }
    return candidates;
}
