'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense' | string;
};

type CategoryBudget = {
    id: string;
    category_id: string;
    month: string;
    amount: number;
};

type Transaction = {
    id: string;
    date: string;
    amount: number;
    categoryId: string | null;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    category_id: string | null;
};

export default function BudgetPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [budgetCategoryId, setBudgetCategoryId] = useState<string>('');
    const [budgetAmount, setBudgetAmount] = useState<string>('');
    const [notification, setNotification] = useState<string | null>(null);

    const [monthDate, setMonthDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const monthStr = useMemo(
        () =>
            `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(
                2,
                '0',
            )}`,
        [monthDate],
    );

    const monthLabel = useMemo(
        () =>
            monthDate.toLocaleString('default', {
                month: 'long',
                year: 'numeric',
            }),
        [monthDate],
    );

    const goToPrevMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
        );
    };

    const goToNextMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
        );
    };

    // Load categories, budgets, and transactions for selected month
    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const startOfMonth = new Date(
                monthDate.getFullYear(),
                monthDate.getMonth(),
                1,
            );
            const endOfMonth = new Date(
                monthDate.getFullYear(),
                monthDate.getMonth() + 1,
                1,
            );

            const startStr = startOfMonth.toISOString().slice(0, 10);
            const endStr = endOfMonth.toISOString().slice(0, 10);

            const [
                { data: categoriesData, error: categoriesError },
                { data: budgetsData, error: budgetsError },
                { data: txData, error: txError },
            ] = await Promise.all([
                supabase.from('categories').select('id, name, type'),
                supabase
                    .from('category_budgets')
                    .select('id, category_id, month, amount')
                    .eq('month', monthStr),
                supabase
                    .from('transactions')
                    .select('id, date, amount, category_id')
                    .gte('date', startStr)
                    .lt('date', endStr)
                    .order('date', { ascending: false }),
            ]);

            if (categoriesError) console.error('categoriesError', categoriesError);
            if (budgetsError) console.error('budgetsError', budgetsError);
            if (txError) console.error('txError', txError);

            setCategories((categoriesData as Category[]) ?? []);
            setBudgets((budgetsData as CategoryBudget[]) ?? []);

            const mapped: Transaction[] =
                ((txData as TxRow[] | null) ?? []).map(row => ({
                    id: row.id,
                    date: row.date,
                    amount: Number(row.amount),
                    categoryId: row.category_id,
                }));

            setTransactions(mapped);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Budget load failed', err);
            setLoading(false);
        });
    }, [monthDate, monthStr]);

    const budgetsByCategoryId = useMemo(() => {
        const map = new Map<string, CategoryBudget>();
        budgets.forEach(b => {
            map.set(b.category_id, b);
        });
        return map;
    }, [budgets]);

    const spendingByCategoryId = useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach(tx => {
            if (!tx.categoryId) return;
            if (tx.amount >= 0) return; // only expenses
            const prev = map.get(tx.categoryId) || 0;
            map.set(tx.categoryId, prev + Math.abs(tx.amount));
        });
        return map;
    }, [transactions]);

    const handleSaveBudget = async (e: FormEvent) => {
        e.preventDefault();

        if (!budgetCategoryId) return;

        const numAmount = Number(budgetAmount);
        if (Number.isNaN(numAmount)) return;

        setNotification(null);

        // Check if a budget already exists for this category + month
        const { data: existingRows, error: fetchError } = await supabase
            .from('category_budgets')
            .select('id, amount')
            .eq('category_id', budgetCategoryId)
            .eq('month', monthStr)
            .limit(1);

        if (fetchError) {
            console.error(fetchError);
            setNotification('Error saving budget. Check console/logs.');
            return;
        }

        if (existingRows && existingRows.length > 0) {
            // Update
            const id = existingRows[0].id;
            const { error: updateError } = await supabase
                .from('category_budgets')
                .update({ amount: numAmount })
                .eq('id', id);

            if (updateError) {
                console.error(updateError);
                setNotification('Error updating budget. Check console/logs.');
                return;
            }
        } else {
            // Insert new
            const { error: insertError } = await supabase
                .from('category_budgets')
                .insert({
                    category_id: budgetCategoryId,
                    month: monthStr,
                    amount: numAmount,
                });

            if (insertError) {
                console.error(insertError);
                setNotification('Error creating budget. Check console/logs.');
                return;
            }
        }

        // Reload budgets for this month
        const { data: budgetsData, error: budgetsError } = await supabase
            .from('category_budgets')
            .select('id, category_id, month, amount')
            .eq('month', monthStr);

        if (budgetsError) {
            console.error(budgetsError);
            setNotification('Error reloading budgets. Check console/logs.');
        } else {
            setBudgets((budgetsData as CategoryBudget[]) ?? []);

            const catName =
                categories.find(c => c.id === budgetCategoryId)?.name || 'This category';
            setNotification(
                `Budget set for ${catName} in ${monthLabel}: $${numAmount.toFixed(2)}.`,
            );
        }
    };

    return (
        <section className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Budget</h2>
                    <p className="text-xs text-slate-400">
                        Plan how every dollar will be used this month.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                    <button
                        type="button"
                        onClick={goToPrevMonth}
                        className="rounded-full border border-slate-700 px-2 py-1 hover:bg-slate-800"
                    >
                        ◀
                    </button>
                    <span>{monthLabel}</span>
                    <button
                        type="button"
                        onClick={goToNextMonth}
                        className="rounded-full border border-slate-700 px-2 py-1 hover:bg-slate-800"
                    >
                        ▶
                    </button>
                </div>
            </div>

            {notification && (
                <div className="rounded-md border border-emerald-600 bg-emerald-950 px-4 py-2 text-xs text-emerald-200">
                    {notification}
                </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-2 text-sm font-semibold">Budgets this month</h3>

                {/* Budget editor */}
                <form
                    onSubmit={handleSaveBudget}
                    className="mb-3 flex flex-col gap-2 text-[11px] md:flex-row md:items-end"
                >
                    <div className="flex-1 space-y-1">
                        <label className="block text-slate-300">Category</label>
                        <select
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                            value={budgetCategoryId}
                            onChange={e => {
                                const nextId = e.target.value;
                                setBudgetCategoryId(nextId);

                                if (!nextId) {
                                    setBudgetAmount('');
                                    return;
                                }

                                const existing = budgetsByCategoryId.get(nextId);
                                if (existing) {
                                    setBudgetAmount(existing.amount.toString());
                                } else {
                                    setBudgetAmount('');
                                }
                            }}
                        >
                            <option value="">Select category</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.type === 'income' ? '⬆️' : '⬇️'} {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="w-28 space-y-1">
                        <label className="block text-slate-300">Amount</label>
                        <input
                            type="number"
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                            value={budgetAmount}
                            onChange={e => setBudgetAmount(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="rounded-md bg-amber-400 px-3 py-2 text-[11px] font-semibold text-black hover:bg-amber-300"
                    >
                        Save budget
                    </button>
                </form>

                {/* Budget list */}
                {loading ? (
                    <div className="text-[11px] text-slate-400">Loading budgets…</div>
                ) : (
                    <div className="space-y-2">
                        {categories.map(cat => {
                            const budgetRecord = budgetsByCategoryId.get(cat.id);
                            const spent = spendingByCategoryId.get(cat.id) || 0;
                            const budgetAmountValue = budgetRecord?.amount ?? 0;
                            const remaining = budgetAmountValue - spent;

                            const pct =
                                budgetAmountValue > 0
                                    ? Math.min(100, (spent / budgetAmountValue) * 100)
                                    : 0;

                            const barColorClass =
                                remaining < 0
                                    ? 'bg-red-500'
                                    : pct > 90
                                        ? 'bg-yellow-400'
                                        : 'bg-emerald-500';

                            return (
                                <div
                                    key={cat.id}
                                    className="rounded-md bg-slate-950 p-2 shadow-sm shadow-slate-900"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium text-slate-100">{cat.name}</div>
                                        <div className="text-[11px] text-slate-300">
                                            Spent ${spent.toFixed(2)} / Budget $
                                            {budgetAmountValue.toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                                        <div
                                            className={`h-1.5 rounded-full ${barColorClass}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-400">
                                        Remaining: ${remaining.toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
