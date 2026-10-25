import type { SupabaseClient } from '@supabase/supabase-js';

const PREF_KEY = 'accountCreditLimits';

type Preferences = Record<string, unknown>;

function asCreditLimitMap(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
        const n = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isFinite(n) && n >= 0) out[id] = n;
    }
    return out;
}

/** Load account-id → credit limit map from user_profile.preferences. */
export async function loadAccountCreditLimitMap(
    supabase: SupabaseClient,
    userId: string
): Promise<Record<string, number>> {
    const { data, error } = await supabase
        .from('user_profile')
        .select('preferences')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('loadAccountCreditLimitMap', error);
        return {};
    }
    const prefs = (data?.preferences || {}) as Preferences;
    return asCreditLimitMap(prefs[PREF_KEY]);
}

/** Persist one account's credit limit (creates user_profile row if needed). */
export async function saveAccountCreditLimit(
    supabase: SupabaseClient,
    userId: string,
    accountId: string,
    creditLimit: number | null
): Promise<{ error: string | null }> {
    const { data: existing, error: readErr } = await supabase
        .from('user_profile')
        .select('id, preferences')
        .eq('user_id', userId)
        .maybeSingle();
    if (readErr) {
        console.error('saveAccountCreditLimit read', readErr);
        return { error: readErr.message };
    }

    const prefs: Preferences = {
        ...((existing?.preferences as Preferences) || {}),
    };
    const map = asCreditLimitMap(prefs[PREF_KEY]);
    if (creditLimit == null || !Number.isFinite(creditLimit) || creditLimit < 0) {
        delete map[accountId];
    } else {
        map[accountId] = creditLimit;
    }
    prefs[PREF_KEY] = map;

    if (existing?.id) {
        const { error } = await supabase
            .from('user_profile')
            .update({ preferences: prefs, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        if (error) {
            console.error('saveAccountCreditLimit update', error);
            return { error: error.message };
        }
        return { error: null };
    }

    const { error } = await supabase.from('user_profile').insert({
        user_id: userId,
        preferences: prefs,
    });
    if (error) {
        console.error('saveAccountCreditLimit insert', error);
        return { error: error.message };
    }
    return { error: null };
}

export function resolveAccountCreditLimit(
    accountId: string,
    map: Record<string, number>
): number | null {
    const v = map[accountId];
    if (v == null || !Number.isFinite(v) || v < 0) return null;
    return v;
}
