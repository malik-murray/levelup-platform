'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Transaction = {
    id: string;
    date: string;
    amount: number;
    person: string;
    note: string | null;
    account: string | null;
    category: string | null;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    person: string;
    note: string | null;
    account_id: string | null;
    category_id: string | null;
    accounts:
        | { id: string | null; name: string | null }
        | { id: string | null; name: string | null }[]
        | null;
    categories:
        | { id: string | null; name: string | null }
        | { id: string | null; name: string | null }[]
        | null;
};

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // month state
    const [monthDate, setMonthDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const monthStr = useMemo(
        () =>
            `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(
                2,
                '0'
            )}`,
        [monthDate]
    );

    const monthLabel = useMemo(
        () =>
            monthDate.toLocaleString('default', {
                month: 'long',
                year: 'numeric',
            }),
        [monthDate]
    );

    const goToPrevMonth = () => {
        setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    // load transactions for selected month
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setNotification(null);

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

            // ✅ Format as "YYYY-MM-DD" because your `date` column is a DATE
            const startStr = startOfMonth.toISOString().slice(0, 10);
            const endStr = endOfMonth.toISOString().slice(0, 10);

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

            // 🔍 Debug log so we SEE what's happening
            console.log('TX RAW RESULT (transactions page):', { txData, txError });

            if (txError) {
                console.error(txError);
                setNotification('Error loading transactions. Check console/logs.');
                setTransactions([]);
                setLoading(false);
                return;
            }

            const rows = (txData ?? []) as TxRow[];

            const getRelName = (
                rel:
                    | { id: string | null; name: string | null }
                    | { id: string | null; name: string | null }[]
                    | null
            ) => {
                if (!rel) return null;
                if (Array.isArray(rel)) {
                    return rel.length > 0 ? rel[0].name ?? null : null;
                }
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
            }));

            setTransactions(mapped);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Transactions load failed', err);
            setNotification('Error loading transactions. Check console/logs.');
            setLoading(false);
        });
    }, [monthDate]);


    const totalIn = useMemo(
        () =>
            transactions
                .filter(tx => tx.amount > 0)
                .reduce((sum, tx) => sum + tx.amount, 0),
        [transactions]
    );

    const totalOut = useMemo(
        () =>
            transactions
                .filter(tx => tx.amount < 0)
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
        [transactions]
    );

    const net = totalIn - totalOut;

    return (
        <section className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Transactions</h2>
                    <p className="text-xs text-slate-400">
                        View all activity for the selected month.
                    </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300">
                    <button
                        type="button"
                        onClick={goToPrevMonth}
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 hover:bg-slate-800"
                    >
                        ◀
                    </button>
                    <span>{monthLabel}</span>
                    <button
                        type="button"
                        onClick={goToNextMonth}
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 hover:bg-slate-800"
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

            {/* Month summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase text-slate-400">Income</p>
                    <p className="text-xl font-semibold text-emerald-400">
                        ${totalIn.toFixed(2)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase text-slate-400">Expenses</p>
                    <p className="text-xl font-semibold text-red-400">
                        ${totalOut.toFixed(2)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase text-slate-400">Net</p>
                    <p
                        className={`text-xl font-semibold ${
                            net >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                    >
                        ${net.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Transactions list */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-2 text-sm font-semibold">All transactions</h3>

                {loading ? (
                    <p className="text-slate-400">Loading…</p>
                ) : transactions.length === 0 ? (
                    <p className="text-slate-400">
                        No transactions for {monthLabel}. Add one from the Home page.
                    </p>
                ) : (
                    <div className="max-h-[540px] space-y-2 overflow-y-auto">
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
                                        {tx.date} • {tx.person}
                                        {tx.note ? ` • ${tx.note}` : ''}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div
                                        className={`text-xs font-semibold ${
                                            tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        }`}
                                    >
                                        {tx.amount >= 0 ? '+' : '-'}$
                                        {Math.abs(tx.amount).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
