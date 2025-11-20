'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

console.log('FINANCE PAGE LOADED, URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

type Account = {
    id: string;
    name: string;
};

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense' | string;
};

type Transaction = {
    id: string;
    date: string;
    amount: number;
    person: string;
    note: string | null;
    // display values
    account: string | null;
    category: string | null;
    // IDs for CRUD
    accountId: string | null;
    categoryId: string | null;
};

type CategoryBudget = {
    id: string;
    category_id: string;
    month: string;
    amount: number;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    person: string;
    note: string | null;
    account_id: string | null;
    category_id: string | null;
    // Supabase might return a single object or an array
    accounts:
        | { id: string | null; name: string | null }
        | { id: string | null; name: string | null }[]
        | null;
    categories:
        | { id: string | null; name: string | null }
        | { id: string | null; name: string | null }[]
        | null;
};

export default function FinancePage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
    const [loading, setLoading] = useState(true);

    // form state
    const [date, setDate] = useState<string>(() =>
        new Date().toISOString().slice(0, 10)
    );
    const [accountId, setAccountId] = useState<string>('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [amount, setAmount] = useState<string>('0');
    const [person, setPerson] = useState<string>('Malik');
    const [note, setNote] = useState<string>('');

    // which transaction are we editing? null = adding new
    const [editingId, setEditingId] = useState<string | null>(null);

    // budget editor state
    const [budgetCategoryId, setBudgetCategoryId] = useState<string>('');
    const [budgetAmount, setBudgetAmount] = useState<string>('');

    // simple in-app notification text
    const [notification, setNotification] = useState<string | null>(null);

    // month selector state: store the first day of the currently selected month
    const [monthDate, setMonthDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // YYYY-MM string for queries and filtering
    const monthStr = useMemo(
        () =>
            `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(
                2,
                '0'
            )}`,
        [monthDate]
    );

    // Pretty label like "November 2025"
    const monthLabel = useMemo(
        () =>
            monthDate.toLocaleString('default', {
                month: 'long',
                year: 'numeric',
            }),
        [monthDate]
    );

    const goToPrevMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        );
    };

    const goToNextMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        );
    };

    // helper to load transactions for the currently selected month
    const reloadTransactionsForMonth = async (): Promise<Transaction[]> => {
        const startOfMonth = new Date(
            monthDate.getFullYear(),
            monthDate.getMonth(),
            1
        );
        const endOfMonth = new Date(
            monthDate.getFullYear(),
            monthDate.getMonth() + 1,
            1
        );

        // ✅ Only keep the date part for a DATE column
        const startStr = startOfMonth.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const endStr = endOfMonth.toISOString().slice(0, 10); // "YYYY-MM-DD"

        const { data: txData, error: txError } = await supabase
            .from('transactions')
            .select(`
        id,
        date,
        amount,
        person,
        note,
        account_id,
        category_id,
        accounts ( id, name ),
        categories ( id, name )
    `)
            .gte('date', startStr)
            .lt('date', endStr)
            .order('date', { ascending: false });

        console.log('TX RESULT:', { txData, txError });

        if (txError) {
            console.error(txError);
            return [];
        }

        const rows = (txData ?? []) as TxRow[];
        const getRelName = (
            rel:
                | { id: string | null; name: string | null }
                | { id: string | null; name: string | null }[]
                | null
        ) => {
            if (!rel) return null;

            // If it's an array → use first element
            if (Array.isArray(rel)) {
                return rel.length > 0 ? rel[0].name ?? null : null;
            }

            // If it's a single object
            return rel.name ?? null;
        };

        const mapped: Transaction[] = rows.map(tx => ({
            id: tx.id,
            date: tx.date,
            amount: Number(tx.amount),
            person: tx.person,
            note: tx.note,
            account: getRelName(tx.accounts),
            category: getRelName(tx.categories),
            accountId: tx.account_id,
            categoryId: tx.category_id,
        }));

        setTransactions(mapped);
        return mapped;
    };

    useEffect(() => {
        console.log('FINANCE PAGE EFFECT RUNNING');

        const loadDebug = async () => {
            console.log('FINANCE: starting debug Supabase queries');

            const { data: accountsData, error: accountsError } = await supabase
                .from('accounts')
                .select('id, name')
                .order('name');

            console.log('FINANCE DEBUG ACCOUNTS:', { accountsData, accountsError });

            const { data: categoriesData, error: categoriesError } = await supabase
                .from('categories')
                .select('id, name, type')
                .order('name');

            console.log('FINANCE DEBUG CATEGORIES:', {
                categoriesData,
                categoriesError,
            });
        };

        loadDebug().catch(err => {
            console.error('FINANCE DEBUG LOAD FAILED:', err);
        });
    }, []);

    // 🔥 Main data load effect
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            console.log('RUNNING SUPABASE QUERIES...');

            // 🔍 DEBUG: raw fetch directly to Supabase REST API
            try {
                const rawUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/accounts?select=id,name&limit=1`;
                console.log('DEBUG RAW FETCH URL:', rawUrl);

                const rawRes = await fetch(rawUrl, {
                    headers: {
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                    },
                });

                const text = await rawRes.text();
                console.log('DEBUG RAW FETCH STATUS:', rawRes.status);
                console.log('DEBUG RAW FETCH BODY:', text);
            } catch (err) {
                console.error('DEBUG RAW FETCH ERROR:', err);
            }

            // 1) ACCOUNTS
            const { data: accountsData, error: accountsError } = await supabase
                .from('accounts')
                .select('id, name')
                .order('name');

            console.log('ACCOUNTS RESULT:', { accountsData, accountsError });

            // 2) CATEGORIES
            const { data: categoriesData, error: categoriesError } = await supabase
                .from('categories')
                .select('id, name, type')
                .order('name');

            console.log('CATEGORIES RESULT:', { categoriesData, categoriesError });

            // 3) BUDGETS
            const { data: budgetsData, error: budgetsError } = await supabase
                .from('category_budgets')
                .select('id, category_id, month, amount')
                .eq('month', monthStr);

            console.log('BUDGETS RESULT:', { budgetsData, budgetsError });

            setAccounts(accountsData ?? []);
            setCategories(categoriesData ?? []);
            setBudgets(budgetsData ?? []);

            // 4) TRANSACTIONS scoped to selected month
            await reloadTransactionsForMonth();

            setLoading(false);
        };

        load().catch(err => {
            console.error('LOAD() FAILED:', err);
            setLoading(false);
        });
    }, [monthDate, monthStr]);

    const thisMonthTx = useMemo(
        () => transactions.filter(tx => tx.date.startsWith(monthStr)),
        [transactions, monthStr]
    );

    const totalIn = thisMonthTx
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
    const totalOut = thisMonthTx
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
    const net = totalIn + totalOut;
    const totalIncome = totalIn;
    const totalExpenses = Math.abs(totalOut);
    const netWorth = totalIncome - totalExpenses; // temp net worth = monthly net

    // helper: spending per category for this month (expenses only, as positive number)
    const spendingByCategoryName = useMemo(() => {
        const map = new Map<string, number>();
        thisMonthTx.forEach(tx => {
            if (!tx.category) return;
            if (tx.amount >= 0) return; // only count expenses
            const prev = map.get(tx.category) || 0;
            map.set(tx.category, prev + Math.abs(tx.amount));
        });
        return map;
    }, [thisMonthTx]);

    const budgetsByCategoryId = useMemo(() => {
        const map = new Map<string, CategoryBudget>();
        budgets.forEach(b => {
            map.set(b.category_id, b);
        });
        return map;
    }, [budgets]);

    const resetFormToDefault = () => {
        setDate(new Date().toISOString().slice(0, 10));
        setAccountId('');
        setCategoryId('');
        setAmount('0');
        setPerson('Malik');
        setNote('');
        setEditingId(null);
    };

    const handleAddOrUpdateTransaction = async (e: FormEvent) => {
        e.preventDefault();

        const numAmount = Number(amount);
        if (!numAmount || !accountId || !categoryId) return;

        setNotification(null);

        if (editingId) {
            // UPDATE existing transaction
            const { error } = await supabase
                .from('transactions')
                .update({
                    date,
                    account_id: accountId,
                    category_id: categoryId,
                    amount: numAmount,
                    person,
                    note: note || null,
                })
                .eq('id', editingId);

            if (error) {
                console.error(error);
                setNotification('Error updating transaction. Check console/logs.');
                return;
            }
        } else {
            // INSERT new transaction
            const { error } = await supabase.from('transactions').insert({
                date,
                account_id: accountId,
                category_id: categoryId,
                amount: numAmount,
                person,
                note: note || null,
            });

            if (error) {
                console.error(error);
                setNotification('Error saving transaction. Check console/logs.');
                return;
            }
        }

        // Reload list after insert/update, scoped to the currently selected month
        const newTransactions = await reloadTransactionsForMonth();

        // compute notification about remaining budget for this category
        const selectedCategory = categories.find(c => c.id === categoryId);
        const selectedCategoryName = selectedCategory?.name ?? null;

        if (selectedCategoryName) {
            const budgetRecord = budgetsByCategoryId.get(categoryId);
            if (budgetRecord) {
                const updatedThisMonthTx = newTransactions.filter(tx =>
                    tx.date.startsWith(monthStr)
                );
                const updatedSpendingByCategory = new Map<string, number>();
                updatedThisMonthTx.forEach(tx => {
                    if (!tx.category) return;
                    if (tx.amount >= 0) return;
                    const prev = updatedSpendingByCategory.get(tx.category) || 0;
                    updatedSpendingByCategory.set(
                        tx.category,
                        prev + Math.abs(tx.amount)
                    );
                });

                const spent =
                    updatedSpendingByCategory.get(selectedCategoryName) || 0;
                const remaining = budgetRecord.amount - spent;

                const spentStr = spent.toFixed(2);
                const remainingStr = remaining.toFixed(2);

                setNotification(
                    `You just ${editingId ? 'updated' : 'logged'} ${
                        numAmount < 0 ? '-' : '+'
                    }$${Math.abs(numAmount).toFixed(
                        2
                    )} in ${selectedCategoryName}. This month: spent $${spentStr}, remaining $${remainingStr} of your $${budgetRecord.amount.toFixed(
                        2
                    )} budget.`
                );
            } else {
                setNotification(
                    `You just ${editingId ? 'updated' : 'logged'} ${
                        numAmount < 0 ? '-' : '+'
                    }$${Math.abs(numAmount).toFixed(
                        2
                    )} in ${selectedCategoryName}. No budget set for this category.`
                );
            }
        }

        // Reset form state after save/update
        resetFormToDefault();
    };

    const handleSaveBudget = async (e: FormEvent) => {
        e.preventDefault();

        if (!budgetCategoryId) return;

        const numAmount = Number(budgetAmount);
        if (Number.isNaN(numAmount)) return;

        setNotification(null);

        // Check if a budget already exists for this category + month
        const { data: existingRows, error: fetchError } = await supabase
            .from('category_budgets')
            .select('id')
            .eq('category_id', budgetCategoryId)
            .eq('month', monthStr)
            .limit(1);

        if (fetchError) {
            console.error(fetchError);
            setNotification('Error loading existing budget. Check console/logs.');
            return;
        }

        if (existingRows && existingRows.length > 0) {
            // Update existing
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
            setNotification('Budget saved, but failed to reload budgets.');
        } else {
            setBudgets(budgetsData || []);
            const catName =
                categories.find(c => c.id === budgetCategoryId)?.name ||
                'This category';
            setNotification(
                `Budget set for ${catName} in ${monthLabel}: $${numAmount.toFixed(
                    2
                )}.`
            );
        }
    };

    // ---- Transaction row CRUD handlers ----

    const handleEditTransaction = (tx: Transaction) => {
        setEditingId(tx.id);
        // date input expects YYYY-MM-DD
        setDate(tx.date.slice(0, 10));
        setAmount(tx.amount.toString());
        setPerson(tx.person);
        setNote(tx.note ?? '');

        // Prefer stored IDs; fall back to matching by name
        if (tx.accountId) {
            setAccountId(tx.accountId);
        } else if (tx.account) {
            const acc = accounts.find(a => a.name === tx.account);
            setAccountId(acc?.id ?? '');
        } else {
            setAccountId('');
        }

        if (tx.categoryId) {
            setCategoryId(tx.categoryId);
        } else if (tx.category) {
            const cat = categories.find(c => c.name === tx.category);
            setCategoryId(cat?.id ?? '');
        } else {
            setCategoryId('');
        }
    };

    const handleCancelEdit = () => {
        resetFormToDefault();
    };

    const handleDeleteTransaction = async (id: string) => {
        setNotification(null);

        // optional confirm
        if (typeof window !== 'undefined') {
            const ok = window.confirm('Delete this transaction?');
            if (!ok) return;
        }

        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            setNotification('Error deleting transaction. Check console/logs.');
            return;
        }

        await reloadTransactionsForMonth();

        // if we were editing this one, reset the form
        if (editingId === id) {
            resetFormToDefault();
        }

        setNotification('Transaction deleted.');
    };

    const handleDuplicateTransaction = async (tx: Transaction) => {
        setNotification(null);

        // resolve account/category IDs (use stored ids, else match by name)
        let accId: string | null = tx.accountId;
        if (!accId && tx.account) {
            const acc = accounts.find(a => a.name === tx.account);
            accId = acc?.id ?? null;
        }

        let catId: string | null = tx.categoryId;
        if (!catId && tx.category) {
            const cat = categories.find(c => c.name === tx.category);
            catId = cat?.id ?? null;
        }

        if (!accId || !catId) {
            setNotification(
                'Cannot duplicate this transaction: missing account or category.'
            );
            return;
        }

        const { error } = await supabase.from('transactions').insert({
            // keep same date; ensure YYYY-MM-DD format
            date: tx.date.slice(0, 10),
            account_id: accId,
            category_id: catId,
            amount: tx.amount,
            person: tx.person,
            note: tx.note,
        });

        if (error) {
            console.error(error);
            setNotification('Error duplicating transaction. Check console/logs.');
            return;
        }

        await reloadTransactionsForMonth();
        setNotification('Transaction duplicated.');
    };

    return (
        <section className="space-y-4 px-6 py-4">
            {notification && (
                <div className="rounded-md border border-amber-500 bg-amber-950 px-4 py-2 text-xs text-amber-100">
                    {notification}
                </div>
            )}
            {/* 🔹 NEW: Dashboard Summary */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                {/* Net Worth */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Net Worth</p>
                    <p className="text-2xl font-semibold text-amber-400">
                        ${netWorth}
                    </p>
                </div>

                {/* Income */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Income</p>
                    <p className="text-2xl font-semibold text-amber-400">
                        ${totalIncome}
                    </p>
                </div>

                {/* Expenses */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Expenses</p>
                    <p className="text-2xl font-semibold text-red-400">
                        ${totalExpenses}
                    </p>
                </div>

                {/* Cashflow */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Cashflow</p>
                    <p
                        className={`text-2xl font-semibold ${
                            net >= 0 ? 'text-amber-400' : 'text-red-400'
                        }`}
                    >
                        ${net}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[2fr,3fr]">
                {/* Left: Add / Edit transaction form */}
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <div className="mb-1 flex items-center justify-between">
                        <h2 className="text-sm font-semibold">
                            {editingId ? 'Edit transaction' : 'Add transaction'}
                        </h2>
                        {editingId && (
                            <span className="text-[10px] text-slate-400">
                                Editing existing transaction
                            </span>
                        )}
                    </div>
                    <form
                        className="space-y-3 text-xs"
                        onSubmit={handleAddOrUpdateTransaction}
                    >
                        <div className="space-y-1">
                            <label className="block text-slate-300">Date</label>
                            <input
                                type="date"
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-slate-300">Account</label>
                            <select
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={accountId}
                                onChange={e => setAccountId(e.target.value)}
                            >
                                <option value="">Select</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-slate-300">Category</label>
                            <select
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                            >
                                <option value="">Select</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.type === 'income' ? '⬆️' : '⬇️'} {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-slate-300">Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-500">
                                Use positive for income, negative for expenses (e.g. -45.23
                                for groceries).
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-slate-300">Person</label>
                            <select
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={person}
                                onChange={e => setPerson(e.target.value)}
                            >
                                <option value="Malik">Malik</option>
                                <option value="Mikia">Mikia</option>
                                <option value="Both">Both</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-slate-300">
                                Note (optional)
                            </label>
                            <input
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="ex. Giant groceries, date night, etc."
                            />
                        </div>

                        <div className="mt-2 flex gap-2">
                            <button
                                type="submit"
                                className="w-full rounded-md bg-amber-400 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                            >
                                {editingId ? 'Update transaction' : 'Save transaction'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="w-full rounded-md border border-slate-600 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                                >
                                    Cancel edit
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Right: Summary + budgets + recent transactions */}
                <div className="space-y-4">
                    {/* Month summary + switcher */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                        <div className="mb-2 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={goToPrevMonth}
                                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] hover:bg-slate-800"
                            >
                                ◀
                            </button>
                            <div className="text-center">
                                <h2 className="text-sm font-semibold">{monthLabel}</h2>
                                <p className="text-[10px] text-slate-400">{monthStr}</p>
                            </div>
                            <button
                                type="button"
                                onClick={goToNextMonth}
                                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] hover:bg-slate-800"
                            >
                                ▶
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <div className="text-slate-400">Money in</div>
                                <div className="mt-1 text-sm font-semibold text-amber-400">
                                    ${totalIn.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-400">Money out</div>
                                <div className="mt-1 text-sm font-semibold text-red-400">
                                    ${Math.abs(totalOut).toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-400">Net</div>
                                <div
                                    className={`mt-1 text-sm font-semibold ${
                                        net >= 0 ? 'text-amber-400' : 'text-red-400'
                                    }`}
                                >
                                    ${net.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent transactions */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                        <h2 className="mb-2 text-sm font-semibold">
                            Recent transactions
                        </h2>
                        {loading ? (
                            <p className="text-slate-400">Loading...</p>
                        ) : transactions.length === 0 ? (
                            <p className="text-slate-400">
                                No transactions yet. Add your first one on the left.
                            </p>
                        ) : (
                            <div className="max-h-72 space-y-2 overflow-y-auto">
                                {transactions.slice(0, 5).map(tx => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {tx.category || 'Uncategorized'} •{' '}
                                                {tx.account || 'No account'}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {tx.date} • {tx.person}
                                                {tx.note ? ` • ${tx.note}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div
                                                className={`text-xs font-semibold ${
                                                    tx.amount >= 0
                                                        ? 'text-amber-400'
                                                        : 'text-red-400'
                                                }`}
                                            >
                                                {tx.amount >= 0 ? '+' : '-'}$
                                                {Math.abs(tx.amount).toFixed(2)}
                                            </div>
                                            <div className="flex gap-2 text-[10px] text-slate-400">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleEditTransaction(tx)
                                                    }
                                                    className="hover:text-amber-300"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleDuplicateTransaction(tx)
                                                    }
                                                    className="hover:text-amber-200"
                                                >
                                                    Duplicate
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleDeleteTransaction(tx.id)
                                                    }
                                                    className="hover:text-red-400"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
