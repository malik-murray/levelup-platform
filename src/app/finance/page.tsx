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
    account: string | null;
    category: string | null;
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
    // Supabase returns these relations as arrays
    accounts: { name: string | null }[] | null;
    categories: { name: string | null }[] | null;
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

            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select(
                    `
          id,
          date,
          amount,
          person,
          note,
          accounts ( name ),
          categories ( name )
        `
                )
                .gte('date', startOfMonth.toISOString())
                .lt('date', endOfMonth.toISOString())
                .order('date', { ascending: false });

            console.log('TX RESULT:', { txData, txError });

            const rows = (txData ?? []) as TxRow[];

            setTransactions(
                rows.map(tx => ({
                    id: tx.id,
                    date: tx.date,
                    amount: Number(tx.amount),
                    person: tx.person,
                    note: tx.note,
                    account: tx.accounts?.[0]?.name ?? null,
                    category: tx.categories?.[0]?.name ?? null,
                }))
            );

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

    const handleAddTransaction = async (e: FormEvent) => {
        e.preventDefault();

        const numAmount = Number(amount);
        if (!numAmount || !accountId || !categoryId) return;

        setNotification(null);

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

        // Reload list after insert, scoped to the currently selected month
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

        const { data: txData, error: reloadError } = await supabase
            .from('transactions')
            .select(
                `
        id,
        date,
        amount,
        person,
        note,
        accounts ( name ),
        categories ( name )
      `
            )
            .gte('date', startOfMonth.toISOString())
            .lt('date', endOfMonth.toISOString())
            .order('date', { ascending: false });

        if (reloadError) {
            console.error(reloadError);
        }

        const rows = (txData ?? []) as TxRow[];

        const newTransactions: Transaction[] = rows.map(tx => ({
            id: tx.id,
            date: tx.date,
            amount: Number(tx.amount),
            person: tx.person,
            note: tx.note,
            account: tx.accounts?.[0]?.name ?? null,
            category: tx.categories?.[0]?.name ?? null,
        }));

        setTransactions(newTransactions);

        // compute notification about remaining budget for this category
        const selectedCategory = categories.find(c => c.id === categoryId);
        const selectedCategoryName = selectedCategory?.name ?? null;

        if (selectedCategoryName) {
            const budgetRecord = budgetsByCategoryId.get(categoryId);
            if (budgetRecord) {
                // recompute thisMonthTx from newTransactions
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
                    `You just logged ${
                        numAmount < 0 ? '-' : '+'
                    }$${Math.abs(numAmount).toFixed(
                        2
                    )} in ${selectedCategoryName}. This month: spent $${spentStr}, remaining $${remainingStr} of your $${budgetRecord.amount.toFixed(
                        2
                    )} budget.`
                );
            } else {
                setNotification(
                    `You just logged ${
                        numAmount < 0 ? '-' : '+'
                    }$${Math.abs(numAmount).toFixed(
                        2
                    )} in ${selectedCategoryName}. No budget set for this category.`
                );
            }
        }

        // Reset amount + note
        setAmount('0');
        setNote('');
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

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <div>
                    <h1 className="text-xl font-semibold">LevelUp Financial</h1>
                    <p className="text-xs text-slate-400">
                        Shared money dashboard for you and your family.
                    </p>
                </div>
            </header>

            <section className="space-y-4 px-6 py-4">
                {notification && (
                    <div className="rounded-md border border-emerald-600 bg-emerald-950 px-4 py-2 text-xs text-emerald-200">
                        {notification}
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-[2fr,3fr]">
                    {/* Left: Add transaction form */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                        <h2 className="mb-3 text-sm font-semibold">Add transaction</h2>
                        <form
                            className="space-y-3 text-xs"
                            onSubmit={handleAddTransaction}
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

                            <button
                                type="submit"
                                className="mt-2 w-full rounded-md bg-emerald-500 py-2 text-xs font-semibold text-black hover:bg-emerald-400"
                            >
                                Save transaction
                            </button>
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
                                    <div className="mt-1 text-sm font-semibold text-emerald-400">
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
                                            net >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        }`}
                                    >
                                        ${net.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Budget vs spending per category + budget editor */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                            <h2 className="mb-2 text-sm font-semibold">
                                Budgets this month
                            </h2>

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
                                            const id = e.target.value;
                                            setBudgetCategoryId(id);

                                            // prefill budget amount if this category already has a budget
                                            const existing = budgetsByCategoryId.get(id);
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
                                <div className="w-full space-y-1 md:w-32">
                                    <label className="block text-slate-300">
                                        Budget amount
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                        value={budgetAmount}
                                        onChange={e => setBudgetAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="rounded-md bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-black hover:bg-emerald-400"
                                >
                                    Save budget
                                </button>
                            </form>

                            {budgets.length === 0 ? (
                                <p className="text-slate-400">
                                    No budgets set yet for {monthLabel}. Set one using the
                                    form above.
                                </p>
                            ) : (
                                <div className="max-h-56 space-y-1 overflow-y-auto">
                                    {budgets.map(b => {
                                        const cat = categories.find(
                                            c => c.id === b.category_id
                                        );
                                        const name = cat?.name ?? 'Unknown';
                                        const spent = spendingByCategoryName.get(name) || 0;
                                        const remaining = b.amount - spent;
                                        const pct = Math.min(
                                            100,
                                            Math.max(0, (spent / b.amount) * 100)
                                        );

                                        return (
                                            <div
                                                key={b.id}
                                                className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                                            >
                                                <div className="mb-1 flex items-center justify-between">
                                                    <span className="font-medium">{name}</span>
                                                    <span className="text-[11px] text-slate-400">
                            Spent ${spent.toFixed(2)} / $
                                                        {b.amount.toFixed(2)}
                          </span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            pct < 80
                                                                ? 'bg-emerald-500'
                                                                : pct < 100
                                                                    ? 'bg-yellow-400'
                                                                    : 'bg-red-500'
                                                        }`}
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
                                    {transactions.map(tx => (
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
                                            <div
                                                className={`text-xs font-semibold ${
                                                    tx.amount >= 0
                                                        ? 'text-emerald-400'
                                                        : 'text-red-400'
                                                }`}
                                            >
                                                {tx.amount >= 0 ? '+' : '-'}$
                                                {Math.abs(tx.amount).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
