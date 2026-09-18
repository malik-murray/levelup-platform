import type { SupabaseClient } from '@supabase/supabase-js';
import {
    defaultLiquidityForType,
    isAccountLiquidity,
    type AccountLiquidity,
    type AccountType,
} from '@/lib/finance/accountBalances';

const PREF_KEY = 'accountLiquidity';

type Preferences = Record<string, unknown>;

function asLiquidityMap(value: unknown): Record<string, AccountLiquidity> {
    if (!value || typeof value !== 'object') return {};
    const out: Record<string, AccountLiquidity> = {};
    for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
        if (isAccountLiquidity(raw)) out[id] = raw;
    }
    return out;
}

/** Load account-id → liquidity map from user_profile.preferences. */
export async function loadAccountLiquidityMap(
    supabase: SupabaseClient,
    userId: string
): Promise<Record<string, AccountLiquidity>> {
    const { data, error } = await supabase
        .from('user_profile')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('loadAccountLiquidityMap', error);
        return {};
    }
    const prefs = (data?.preferences || {}) as Preferences;
    return asLiquidityMap(prefs[PREF_KEY]);
}

/** Persist one account's liquidity tag (creates user_profile row if needed). */
export async function saveAccountLiquidity(
    supabase: SupabaseClient,
    userId: string,
    accountId: string,
    liquidity: AccountLiquidity | null
): Promise<{ error: string | null }> {
    const { data: existing, error: readErr } = await supabase
        .from('user_profile')
        .select('id, preferences')
        .eq('user_id', userId)
        .maybeSingle();
    if (readErr) {
        console.error('saveAccountLiquidity read', readErr);
        return { error: readErr.message };
    }

    const prefs: Preferences = {
        ...((existing?.preferences as Preferences) || {}),
    };
    const map = asLiquidityMap(prefs[PREF_KEY]);
    if (liquidity == null) delete map[accountId];
    else map[accountId] = liquidity;
    prefs[PREF_KEY] = map;

    if (existing?.id) {
        const { error } = await supabase
            .from('user_profile')
            .update({ preferences: prefs, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        if (error) {
            console.error('saveAccountLiquidity update', error);
            return { error: error.message };
        }
        return { error: null };
    }

    const { error } = await supabase.from('user_profile').insert({
        user_id: userId,
        preferences: prefs,
    });
    if (error) {
        console.error('saveAccountLiquidity insert', error);
        return { error: error.message };
    }
    return { error: null };
}

export function resolveAccountLiquidity(
    accountId: string,
    type: AccountType | null | undefined,
    map: Record<string, AccountLiquidity>
): AccountLiquidity | null {
    if (map[accountId]) return map[accountId];
    return defaultLiquidityForType(type);
}
