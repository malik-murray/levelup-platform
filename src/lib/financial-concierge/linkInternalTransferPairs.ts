import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export type LinkInternalTransferPairsOptions = {
    /** Only consider transactions on or after this many days ago (default 730). */
    sinceDays?: number;
};

export type LinkInternalTransferPairsResult = {
    pairsLinked: number;
    transferRowsCategoryFixed: number;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    account_id: string | null;
    name: string | null;
    note: string | null;
    is_transfer: boolean;
    transfer_group_id: string | null;
    category_id: string | null;
};

function moneyCents(amount: number): number {
    return Math.round(Math.abs(amount) * 100);
}

function transferBucketKey(date: string, amount: number): string {
    return `${date}|${moneyCents(amount)}`;
}

function labelText(tx: TxRow): string {
    return `${tx.name || ''} ${tx.note || ''}`.toLowerCase();
}

/** Token overlap score for picking the best opposite-leg match. */
function pairAffinity(neg: TxRow, pos: TxRow): number {
    const a = labelText(neg);
    const b = labelText(pos);
    if (!a.trim() || !b.trim()) return 0;
    const ta = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const tb = new Set(b.split(/\s+/).filter(w => w.length > 2));
    let overlap = 0;
    for (const w of ta) {
        if (tb.has(w)) overlap++;
    }
    return overlap;
}

function mergeNotes(a: string | null, b: string | null): string | null {
    const x = (a || '').trim();
    const y = (b || '').trim();
    if (!x) return y || null;
    if (!y || x === y) return x;
    return `${x} • ${y}`;
}

/**
 * Finds opposite-sign, same-date, same-magnitude pairs on different accounts among
 * rows that are not yet marked `is_transfer`.
 */
export function findOppositeAccountTransferPairs(rows: TxRow[]): Array<{ neg: TxRow; pos: TxRow }> {
    const candidates = rows.filter(
        r => !r.is_transfer && r.account_id && r.amount !== 0 && moneyCents(r.amount) > 0
    );
    const byKey = new Map<string, TxRow[]>();
    for (const r of candidates) {
        const k = transferBucketKey(r.date, r.amount);
        const list = byKey.get(k);
        if (list) list.push(r);
        else byKey.set(k, [r]);
    }

    const pairs: Array<{ neg: TxRow; pos: TxRow }> = [];
    const used = new Set<string>();

    for (const group of byKey.values()) {
        const negatives = group
            .filter(r => r.amount < 0)
            .sort((a, b) => a.id.localeCompare(b.id));
        const positives = group
            .filter(r => r.amount > 0)
            .sort((a, b) => a.id.localeCompare(b.id));

        for (const neg of negatives) {
            if (used.has(neg.id)) continue;
            const avail = positives.filter(
                p => !used.has(p.id) && p.account_id !== neg.account_id
            );
            if (avail.length === 0) continue;

            let best = avail[0];
            let bestScore = pairAffinity(neg, best);
            for (let i = 1; i < avail.length; i++) {
                const p = avail[i];
                const s = pairAffinity(neg, p);
                if (s > bestScore || (s === bestScore && p.id.localeCompare(best.id) < 0)) {
                    best = p;
                    bestScore = s;
                }
            }
            pairs.push({ neg, pos: best });
            used.add(neg.id);
            used.add(best.id);
        }
    }

    return pairs;
}

async function resolveTransferCategoryId(
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> {
    const { data, error } = await supabase
        .from('categories')
        .select('id, user_id, name, type, kind')
        .eq('kind', 'category')
        .eq('is_archived', false)
        .or(`user_id.eq.${userId},user_id.is.null`);

    if (error || !data?.length) return null;

    const leaves = data.filter(
        (c: { name?: string; type?: string | null }) =>
            (c.type as string) === 'transfer' || (c.name || '').trim().toLowerCase() === 'transfer'
    );
    const userRow = leaves.find((c: { user_id: string | null }) => c.user_id === userId);
    const globalRow = leaves.find((c: { user_id: string | null }) => c.user_id == null);
    return (userRow || globalRow)?.id ?? null;
}

/**
 * Links same-day, opposite-sign, equal-magnitude transactions on different accounts into
 * `is_transfer` groups (two legs), assigns the canonical **Transfer** category, and normalizes
 * labels like manual transfers. Rows already `is_transfer` get the Transfer category when missing
 * or different.
 */
export async function linkInternalTransferPairsForUser(
    supabase: SupabaseClient,
    userId: string,
    options: LinkInternalTransferPairsOptions = {}
): Promise<LinkInternalTransferPairsResult> {
    const sinceDays = options.sinceDays ?? 730;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sinceDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const transferCategoryId = await resolveTransferCategoryId(supabase, userId);

    const [{ data: txRows, error: txErr }, { data: accounts, error: accErr }] = await Promise.all([
        supabase
            .from('transactions')
            .select('id, date, amount, account_id, name, note, is_transfer, transfer_group_id, category_id')
            .eq('user_id', userId)
            .gte('date', cutoffStr),
        supabase.from('accounts').select('id, name').eq('user_id', userId),
    ]);

    if (txErr) {
        console.error('linkInternalTransferPairsForUser transactions:', txErr);
        return { pairsLinked: 0, transferRowsCategoryFixed: 0 };
    }
    if (accErr) {
        console.error('linkInternalTransferPairsForUser accounts:', accErr);
    }

    const rows = (txRows || []) as TxRow[];
    const accountName = new Map<string, string>();
    for (const a of accounts || []) {
        accountName.set(a.id as string, (a.name as string) || 'Unknown');
    }

    let pairsLinked = 0;
    let transferRowsCategoryFixed = 0;

    const pairs = findOppositeAccountTransferPairs(rows);
    for (const { neg, pos } of pairs) {
        const groupId = randomUUID();
        const fromName = accountName.get(neg.account_id!) || 'Unknown';
        const toName = accountName.get(pos.account_id!) || 'Unknown';
        const transferLabel = `Transfer: ${fromName} → ${toName}`;
        const mergedNote = mergeNotes(neg.note, pos.note);

        const patch = {
            is_transfer: true,
            transfer_group_id: groupId,
            category_id: transferCategoryId ?? null,
            person: transferLabel,
            name: null as string | null,
            note: mergedNote,
        };

        const { error: e1 } = await supabase.from('transactions').update(patch).eq('id', neg.id).eq('user_id', userId);
        const { error: e2 } = await supabase.from('transactions').update(patch).eq('id', pos.id).eq('user_id', userId);
        if (!e1 && !e2) pairsLinked++;
        else {
            console.error('linkInternalTransferPairsForUser pair update', e1 || e2);
        }
    }

    const transferRows = rows.filter(r => r.is_transfer);
    if (transferCategoryId && transferRows.length > 0) {
        const results = await Promise.all(
            transferRows.map(async r => {
                if (r.category_id === transferCategoryId) return false;
                const { error } = await supabase
                    .from('transactions')
                    .update({ category_id: transferCategoryId })
                    .eq('id', r.id)
                    .eq('user_id', userId);
                if (error) {
                    console.error('linkInternalTransferPairsForUser category fix', error);
                    return false;
                }
                return true;
            })
        );
        transferRowsCategoryFixed = results.filter(Boolean).length;
    }

    return { pairsLinked, transferRowsCategoryFixed };
}
