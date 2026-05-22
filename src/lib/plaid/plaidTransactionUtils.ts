import type { Transaction } from 'plaid';

/** App convention: negative = spending, positive = income (inverse of Plaid amount). */
export function mapPlaidAmount(plaidAmount: number): number {
    return -plaidAmount;
}

export function isSpendingAmount(amount: number): boolean {
    return amount < 0;
}

export function snapshotPlaidPfc(plaidTransaction: Transaction): {
    primary: string;
    detailed: string;
    confidence_level?: string | null;
    version?: string | null;
} | null {
    const pfc = plaidTransaction.personal_finance_category;
    if (!pfc || (!pfc.primary && !pfc.detailed)) return null;
    return {
        primary: pfc.primary,
        detailed: pfc.detailed,
        confidence_level: pfc.confidence_level ?? null,
        version: pfc.version ?? null,
    };
}

export function parsePlaidDatetime(plaidTransaction: Transaction): string | null {
    const raw =
        plaidTransaction.datetime ||
        plaidTransaction.authorized_datetime ||
        null;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function canonicalNotificationTransactionId(params: {
    original_pending_transaction_id: string | null;
    plaid_transaction_id: string | null;
}): string | null {
    return (
        params.original_pending_transaction_id ||
        params.plaid_transaction_id ||
        null
    );
}

export function spendNotificationIdempotencyKey(
    userId: string,
    canonicalTransactionId: string
): string {
    return `transaction_spend_alert:${userId}:${canonicalTransactionId}`;
}

export function normalizeMerchantLabel(name: string | null, merchantName: string | null): string {
    const label = (merchantName || name || 'Unknown merchant').trim();
    return label || 'Unknown merchant';
}

export function merchantLabelsMatch(
    aName: string | null,
    aMerchant: string | null,
    bName: string | null,
    bMerchant: string | null
): boolean {
    const a = normalizeMerchantLabel(aName, aMerchant).toLowerCase();
    const b = normalizeMerchantLabel(bName, bMerchant).toLowerCase();
    if (a === b) return true;
    if (a.length >= 4 && b.includes(a)) return true;
    if (b.length >= 4 && a.includes(b)) return true;
    return false;
}

export function amountsMatch(a: number, b: number, tolerance = 0.01): boolean {
    return Math.abs(a - b) <= tolerance;
}

export function datesWithinWindow(
    a: string,
    b: string,
    maxDays: number
): boolean {
    const da = new Date(`${a}T12:00:00Z`).getTime();
    const db = new Date(`${b}T12:00:00Z`).getTime();
    if (Number.isNaN(da) || Number.isNaN(db)) return false;
    const diffDays = Math.abs(da - db) / (1000 * 60 * 60 * 24);
    return diffDays <= maxDays;
}

export type PendingMatchCandidate = {
    id: string;
    date: string;
    amount: number;
    name: string | null;
    note: string | null;
    pending: boolean;
    notified_at: string | null;
    plaid_transaction_id: string | null;
    original_pending_transaction_id: string | null;
};

/**
 * Fuzzy match a posted Plaid transaction to an existing pending row.
 */
export function findConfidentPendingMatch(
    posted: {
        accountId: string;
        date: string;
        amount: number;
        name: string | null;
        merchantName: string | null;
    },
    candidates: PendingMatchCandidate[],
    options?: { maxDays?: number }
): PendingMatchCandidate | null {
    const maxDays = options?.maxDays ?? 5;
    let best: PendingMatchCandidate | null = null;
    let bestScore = 0;

    for (const row of candidates) {
        if (!row.pending) continue;
        if (!amountsMatch(row.amount, posted.amount)) continue;
        if (!datesWithinWindow(row.date, posted.date, maxDays)) continue;
        if (!merchantLabelsMatch(row.name, row.note, posted.name, posted.merchantName)) {
            continue;
        }
        const score =
            (normalizeMerchantLabel(row.name, row.note).toLowerCase() ===
            normalizeMerchantLabel(posted.name, posted.merchantName).toLowerCase()
                ? 2
                : 1) + (row.date === posted.date ? 1 : 0);
        if (score > bestScore) {
            bestScore = score;
            best = row;
        }
    }

    return bestScore >= 2 ? best : null;
}
