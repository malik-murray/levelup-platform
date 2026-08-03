/**
 * Pure helpers for Budget Overview cashflow totals and sticky assigned amounts.
 * Kept separate from budgetGroups.ts so unit tests don't need a Supabase client.
 */

import type { BudgetGroup } from './types';

export type CashflowCategoryRef = {
    type?: string | null;
    name?: string | null;
};

/**
 * Month cashflow from raw transactions — same rules as the transactions page:
 * positive amounts = income, negative amounts = expenses.
 * Excludes internal transfers (`is_transfer`) and Savings/Investing categories so
 * contributions to savings never inflate Expenses.
 */
export function computeMonthCashflow(
    transactions: Array<{
        amount: number;
        is_transfer?: boolean | null;
        category_id?: string | null;
    }>,
    categoryById?: Map<string, CashflowCategoryRef>
): { totalIncome: number; totalExpenses: number } {
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const tx of transactions) {
        if (tx.is_transfer) continue;
        if (tx.category_id && categoryById) {
            const cat = categoryById.get(tx.category_id);
            if (cat && isSavingsInvestingBucket(cat.type, cat.name)) continue;
        }
        if (tx.amount > 0) totalIncome += tx.amount;
        else if (tx.amount < 0) totalExpenses += Math.abs(tx.amount);
    }
    return { totalIncome, totalExpenses };
}

/** Expense-category assigned total (absolute), used as "Total Amount Budgeted".
 * Excludes plain Transfer groups — account moves aren't spending targets.
 */
export function computeTotalBudgeted(groups: BudgetGroup[]): number {
    return groups
        .filter(
            (g) =>
                g.type === 'expense' && !isPlainTransferCategory(g.type, g.name)
        )
        .reduce((sum, g) => sum + Math.abs(g.totalAssigned), 0);
}

/**
 * Resolve one sticky assigned amount per category from month-keyed rows.
 * Latest YYYY-MM wins so the budget carries forward until manually changed.
 */
export function resolveStickyBudgetAmounts(
    budgets: Array<{ category_id: string; month: string; amount: number }>
): Map<string, number> {
    // Track best month seen per category so a later month always replaces an earlier one.
    const bestMonth = new Map<string, string>();
    const amounts = new Map<string, number>();

    for (const b of budgets) {
        const prev = bestMonth.get(b.category_id);
        if (prev == null || b.month > prev) {
            bestMonth.set(b.category_id, b.month);
            amounts.set(b.category_id, Number(b.amount));
        }
    }
    return amounts;
}

/**
 * True for the plain account-to-account Transfer group/leaf (not Savings/Investing).
 */
export function isPlainTransferCategory(
    type: string | null | undefined,
    name: string | null | undefined
): boolean {
    const n = (name || '').trim().toLowerCase();
    return n === 'transfer' || n === 'transfers';
}

/**
 * True when a category/group should appear under Savings/Investing on the budget page.
 * Matches explicit `type: 'transfer'` or common savings/investing names (seeded Savings
 * groups historically used type `expense`). The plain "Transfer" leaf is excluded — that
 * is for account-to-account moves, not savings goals. Income leaves named Investments are
 * also excluded (revenue, not contributions).
 */
export function isSavingsInvestingBucket(
    type: string | null | undefined,
    name: string | null | undefined
): boolean {
    const n = (name || '').trim().toLowerCase();
    if (isPlainTransferCategory(type, name)) return false;
    if (type === 'transfer') return true;
    // Income → Investments is a revenue leaf, not a savings contribution bucket.
    if (type === 'income') return false;
    return /saving|invest|emergency/i.test(n);
}
