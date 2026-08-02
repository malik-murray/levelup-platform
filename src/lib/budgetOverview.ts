/**
 * Pure helpers for Budget Overview cashflow totals.
 * Kept separate from budgetGroups.ts so unit tests don't need a Supabase client.
 */

import type { BudgetGroup } from './types';

/**
 * Month cashflow from raw transactions — same rules as the transactions page:
 * positive non-transfer amounts = income, negative non-transfer amounts = expenses.
 * Category assignment does not matter.
 */
export function computeMonthCashflow(
    transactions: Array<{ amount: number; is_transfer?: boolean | null }>
): { totalIncome: number; totalExpenses: number } {
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const tx of transactions) {
        if (tx.is_transfer) continue;
        if (tx.amount > 0) totalIncome += tx.amount;
        else if (tx.amount < 0) totalExpenses += Math.abs(tx.amount);
    }
    return { totalIncome, totalExpenses };
}

/** Expense-category assigned total (absolute), used as "Total Amount Budgeted". */
export function computeTotalBudgeted(groups: BudgetGroup[]): number {
    return groups
        .filter((g) => g.type === 'expense')
        .reduce((sum, g) => sum + Math.abs(g.totalAssigned), 0);
}
