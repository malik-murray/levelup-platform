'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';
import { formatDate } from '@/lib/habitHelpers';
import DashboardCollapsibleSection from './DashboardCollapsibleSection';

const PREVIEW_LIMIT = 6;

type CategoryJoin = { name: string | null } | { name: string | null }[] | null;

type DayExpenseRow = {
    id: string;
    amount: number;
    person: string | null;
    note: string | null;
    name: string | null;
    categories: CategoryJoin;
};

function categoryNameFromJoin(categories: CategoryJoin): string | null {
    if (!categories) return null;
    if (Array.isArray(categories)) return categories[0]?.name ?? null;
    return categories.name ?? null;
}

function expenseLabel(row: DayExpenseRow): string {
    const n = row.name?.trim();
    if (n) return n;
    const p = row.person?.trim();
    if (p) return p;
    const c = categoryNameFromJoin(row.categories)?.trim();
    if (c) return c;
    const note = row.note?.trim();
    if (note) return note.length > 44 ? `${note.slice(0, 41)}…` : note;
    return 'Expense';
}

const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
});

export default function FinanceWidget({
    selectedDate,
    userId,
}: {
    selectedDate: Date;
    userId: string | null;
}) {
    const [open, setOpen] = useState(false);
    const [dayExpenses, setDayExpenses] = useState<DayExpenseRow[]>([]);
    const [monthSpending, setMonthSpending] = useState(0);
    const [monthBudget, setMonthBudget] = useState(0);
    const [loading, setLoading] = useState(true);

    const dayTitle = useMemo(() => {
        const today = new Date();
        const isSameDay =
            selectedDate.getFullYear() === today.getFullYear() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getDate() === today.getDate();
        if (isSameDay) return "Today's expenses";
        return `Expenses · ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }, [selectedDate]);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }
        void loadData();
    }, [selectedDate, userId]);

    const loadData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const dateStr = formatDate(selectedDate);
            const monthStr = dateStr.substring(0, 7);

            const { data: todayRows } = await supabase
                .from('transactions')
                .select(
                    `
          id,
          amount,
          person,
          note,
          name,
          categories ( name )
        `
                )
                .eq('user_id', userId)
                .eq('date', dateStr)
                .eq('is_transfer', false)
                .lt('amount', 0)
                .order('amount', { ascending: true });

            const { data: monthTx } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .gte('date', `${monthStr}-01`)
                .lt('date', `${monthStr}-32`)
                .eq('is_transfer', false)
                .lt('amount', 0);

            const { data: budgets } = await supabase
                .from('category_budgets')
                .select('amount')
                .eq('user_id', userId)
                .eq('month', monthStr);

            setDayExpenses((todayRows as DayExpenseRow[] | null) ?? []);
            const monthTotal = Math.abs(monthTx?.reduce((sum, tx) => sum + tx.amount, 0) || 0);
            const budgetTotal = budgets?.reduce((sum, b) => sum + b.amount, 0) || 0;

            setMonthSpending(monthTotal);
            setMonthBudget(budgetTotal);
        } catch (error) {
            console.error('Error loading finance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const dayTotal = useMemo(
        () => Math.abs(dayExpenses.reduce((sum, tx) => sum + tx.amount, 0)),
        [dayExpenses]
    );

    const previewRows = dayExpenses.slice(0, PREVIEW_LIMIT);
    const moreCount = Math.max(0, dayExpenses.length - PREVIEW_LIMIT);

    const budgetRemaining = monthBudget - monthSpending;
    const budgetPercentage = monthBudget > 0 ? (monthSpending / monthBudget) * 100 : 0;

    return (
        <DashboardCollapsibleSection
            title="Finance tracker"
            open={open}
            onToggle={() => setOpen((o) => !o)}
            headingSize="md"
        >
            <div className="space-y-4 p-4">
                {loading ? (
                    <div className="py-4 text-center text-sm text-slate-400">Loading…</div>
                ) : (
                    <>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#ff9d00]/80">{dayTitle}</p>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-white">{money.format(dayTotal)}</p>
                        </div>

                        {dayExpenses.length === 0 ? (
                            <p className="text-sm text-slate-400">No expenses logged for this day.</p>
                        ) : (
                            <ul className="space-y-2 border-t border-slate-700/80 pt-3">
                                {previewRows.map((row) => (
                                    <li key={row.id} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                                        <span className="min-w-0 truncate text-slate-300" title={expenseLabel(row)}>
                                            {expenseLabel(row)}
                                        </span>
                                        <span className="shrink-0 tabular-nums font-semibold text-rose-300/95">
                                            {money.format(Math.abs(row.amount))}
                                        </span>
                                    </li>
                                ))}
                                {moreCount > 0 ? (
                                    <li className="text-xs text-slate-500">+{moreCount} more in Finance</li>
                                ) : null}
                            </ul>
                        )}

                        <div className="space-y-2 border-t border-slate-700/80 pt-3 text-sm">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-slate-400">Month spending</span>
                                <span className="font-semibold tabular-nums text-white">{money.format(monthSpending)}</span>
                            </div>

                            {monthBudget > 0 && (
                                <>
                                    <div className="flex items-baseline justify-between gap-2">
                                        <span className="text-slate-400">Budget remaining</span>
                                        <span
                                            className={`font-semibold tabular-nums ${budgetRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                                        >
                                            {money.format(budgetRemaining)}
                                        </span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-slate-800">
                                        <div
                                            className={`h-2 rounded-full transition-all ${
                                                budgetPercentage > 100
                                                    ? 'bg-red-500'
                                                    : budgetPercentage > 80
                                                      ? 'bg-yellow-500'
                                                      : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500">{budgetPercentage.toFixed(1)}% of budget used</p>
                                </>
                            )}
                        </div>
                    </>
                )}

                <div className="border-t border-slate-700/80 pt-2">
                    <Link
                        href="/finance"
                        className="text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300"
                    >
                        Open Finance →
                    </Link>
                </div>
            </div>
        </DashboardCollapsibleSection>
    );
}
