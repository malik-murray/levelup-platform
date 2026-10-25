import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

/**
 * Sum all non-removed transaction amounts per account.
 * Paginates past PostgREST's default 1000-row cap so Home and Accounts agree.
 */
export async function loadAllTimeNetByAccountId(
    supabase: SupabaseClient,
    userId: string
): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    let from = 0;

    for (;;) {
        const { data, error } = await supabase
            .from('transactions')
            .select('account_id, amount')
            .eq('user_id', userId)
            .is('removed_at', null)
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('loadAllTimeNetByAccountId', error);
            throw error;
        }

        const rows = data ?? [];
        for (const row of rows) {
            if (!row.account_id) continue;
            map.set(
                row.account_id,
                (map.get(row.account_id) ?? 0) + Number(row.amount)
            );
        }

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return map;
}

export type AllTimeTxRow = {
    id: string;
    date: string;
    amount: number;
    account_id: string | null;
};

/**
 * Load every non-removed transaction (id/date/amount/account_id) with pagination.
 * Used by Home for net-worth history sparks as well as balances.
 */
export async function loadAllTimeTransactions(
    supabase: SupabaseClient,
    userId: string
): Promise<AllTimeTxRow[]> {
    const out: AllTimeTxRow[] = [];
    let from = 0;

    for (;;) {
        const { data, error } = await supabase
            .from('transactions')
            .select('id, date, amount, account_id')
            .eq('user_id', userId)
            .is('removed_at', null)
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            console.error('loadAllTimeTransactions', error);
            throw error;
        }

        const rows = (data ?? []) as AllTimeTxRow[];
        out.push(
            ...rows.map(r => ({
                id: r.id,
                date: r.date,
                amount: Number(r.amount),
                account_id: r.account_id,
            }))
        );

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return out;
}
