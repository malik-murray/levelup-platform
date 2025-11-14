'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

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

export default function FinancePage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // form state
    const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [accountId, setAccountId] = useState<string>('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [amount, setAmount] = useState<string>('0');
    const [person, setPerson] = useState<string>('Malik');
    const [note, setNote] = useState<string>('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const { data: accountsData } = await supabase
                .from('accounts')
                .select('id, name')
                .order('name');

            const { data: categoriesData } = await supabase
                .from('categories')
                .select('id, name, type')
                .order('name');

            const { data: txData } = await supabase
                .from('transactions')
                .select(`
          id,
          date,
          amount,
          person,
          note,
          accounts ( name ),
          categories ( name )
        `)
                .order('date', { ascending: false })
                .limit(30);

            setAccounts(accountsData || []);
            setCategories(categoriesData || []);

            setTransactions(
                (txData || []).map((tx: any) => ({
                    id: tx.id,
                    date: tx.date,
                    amount: Number(tx.amount),
                    person: tx.person,
                    note: tx.note,
                    account: tx.accounts?.name ?? null,
                    category: tx.categories?.name ?? null,
                }))
            );

            setLoading(false);
        };

        load();
    }, []);

    const handleAddTransaction = async (e: FormEvent) => {
        e.preventDefault();

        const numAmount = Number(amount);
        if (!numAmount || !accountId || !categoryId) return;

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
            return;
        }

        // Reload list
        const { data: txData } = await supabase
            .from('transactions')
            .select(`
        id,
        date,
        amount,
        person,
        note,
        accounts ( name ),
        categories ( name )
      `)
            .order('date', { ascending: false })
            .limit(30);

        setTransactions(
            (txData || []).map((tx: any) => ({
                id: tx.id,
                date: tx.date,
                amount: Number(tx.amount),
                person: tx.person,
                note: tx.note,
                account: tx.accounts?.name ?? null,
                category: tx.categories?.name ?? null,
            }))
        );

        // Reset amount + note
        setAmount('0');
        setNote('');
    };

    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const thisMonthTx = transactions.filter(tx => tx.date.startsWith(month));
    const totalIn = thisMonthTx
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
    const totalOut = thisMonthTx
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
    const net = totalIn + totalOut;

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
                <h1 className="text-xl font-semibold">LevelUp Financial</h1>
            </header>

            <section className="px-6 py-6 grid gap-6 md:grid-cols-[2fr,3fr]">
                {/* Left: Add transaction form */}
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <h2 className="mb-3 text-sm font-semibold">Add transaction</h2>
                    <form className="space-y-3 text-xs" onSubmit={handleAddTransaction}>
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
                                    <option key={a.id} value={a.id}>{a.name}</option>
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
                                Use positive for income, negative for expenses (e.g. -45.23 for groceries).
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
                            <label className="block text-slate-300">Note (optional)</label>
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

                {/* Right: Summary + recent transactions */}
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                        <h2 className="mb-2 text-sm font-semibold">This month ({month})</h2>
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
                                <div className={`mt-1 text-sm font-semibold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ${net.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                        <h2 className="mb-2 text-sm font-semibold">Recent transactions</h2>
                        {loading ? (
                            <p className="text-slate-400">Loading...</p>
                        ) : transactions.length === 0 ? (
                            <p className="text-slate-400">No transactions yet. Add your first one on the left.</p>
                        ) : (
                            <div className="max-h-80 overflow-y-auto space-y-2">
                                {transactions.map(tx => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                                    >
                                        <div>
                                            <div className="font-medium">
                                                {tx.category || 'Uncategorized'} • {tx.account || 'No account'}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {tx.date} • {tx.person}{tx.note ? ` • ${tx.note}` : ''}
                                            </div>
                                        </div>
                                        <div className={`text-xs font-semibold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
