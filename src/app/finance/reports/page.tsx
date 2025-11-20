'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@auth/supabaseClient';

type TxRow = {
    id: string;
    date: string;
    amount: number;
};

type MonthSummary = {
    key: string;        // "2025-11"
    label: string;      // "November 2025"
    income: number;
    expenses: number;
    net: number;
};

export default function ReportsPage() {
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // how many months back we look (including current)
    const [monthsBack, setMonthsBack] = useState<number>(6);

    // compute date range based on monthsBack
    const { startDate, endDate } = useMemo(() => {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1); // first of next month
        const start = new Date(now.getFullYear(), now.getMonth() + 1 - monthsBack, 1);
        return { startDate: start, endDate: end };
    }, [monthsBack]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setNotification(null);

            const startStr = startDate.toISOString().slice(0, 10);
            const endStr = endDate.toISOString().slice(0, 10);

            const { data, error } = await supabase
                .from('transactions')
                .select('id, date, amount')
                .gte('date', startStr)
                .lt('date', endStr)
                .order('date', { ascending: true });

            if (error) {
                console.error(error);
                setNotification('Error loading reports data. Check console/logs.');
                setTransactions([]);
                setLoading(false);
                return;
            }

            const rows = (data ?? []).map(row => ({
                id: row.id as string,
                date: row.date as string,
                amount: Number(row.amount),
            }));

            setTransactions(rows);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Reports load failed', err);
            setNotification('Error loading reports data. Check console/logs.');
            setLoading(false);
        });
    }, [startDate, endDate]);

    // Build month-by-month summaries
    const monthSummaries: MonthSummary[] = useMemo(() => {
        if (!transactions.length) return [];

        const map = new Map<string, MonthSummary>();

        transactions.forEach(tx => {
            const dateObj = new Date(tx.date);
            if (Number.isNaN(dateObj.getTime())) return;

            const year = dateObj.getFullYear();
            const monthIndex = dateObj.getMonth(); // 0-11
            const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

            if (!map.has(key)) {
                const label = dateObj.toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                });

                map.set(key, {
                    key,
                    label,
                    income: 0,
                    expenses: 0,
                    net: 0,
                });
            }

            const summary = map.get(key)!;

            if (tx.amount >= 0) {
                summary.income += tx.amount;
            } else {
                const abs = Math.abs(tx.amount);
                summary.expenses += abs;
            }
        });

        // compute net and return sorted by key (chronological)
        const arr = Array.from(map.values());
        arr.forEach(s => {
            s.net = s.income - s.expenses;
        });

        arr.sort((a, b) => (a.key < b.key ? -1 : 1));
        return arr;
    }, [transactions]);

    const totalIncome = useMemo(
        () => monthSummaries.reduce((sum, m) => sum + m.income, 0),
        [monthSummaries],
    );

    const totalExpenses = useMemo(
        () => monthSummaries.reduce((sum, m) => sum + m.expenses, 0),
        [monthSummaries],
    );

    const totalNet = useMemo(
        () => totalIncome - totalExpenses,
        [totalIncome, totalExpenses],
    );

    const monthsLabel = useMemo(() => {
        if (!monthSummaries.length) return '';
        const first = monthSummaries[0]?.label;
        const last = monthSummaries[monthSummaries.length - 1]?.label;
        if (!first || !last) return '';
        return first === last ? first : `${first} – ${last}`;
    }, [monthSummaries]);

    return (
        <section className="space-y-4 px-6 py-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Reports</h2>
                    <p className="text-xs text-slate-400">
                        Income, expenses, and net cashflow over time.
                    </p>
                    {monthsLabel && (
                        <p className="text-[11px] text-slate-500">
                            Period: {monthsLabel}
                        </p>
                    )}
                </div>

                {/* Range selector */}
                <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="text-slate-400">Range:</span>
                    {[3, 6, 12].map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMonthsBack(m)}
                            className={`rounded-full border px-3 py-1 ${
                                monthsBack === m
                                    ? 'border-amber-500 bg-amber-400 text-black'
                                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                            }`}
                        >
                            {m} mo
                        </button>
                    ))}
                </div>
            </div>

            {notification && (
                <div className="rounded-md border border-emerald-600 bg-emerald-950 px-4 py-2 text-xs text-emerald-200">
                    {notification}
                </div>
            )}

            {/* Overall summary cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <p className="text-[10px] uppercase text-slate-400">Total income</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-400">
                        ${totalIncome.toFixed(2)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <p className="text-[10px] uppercase text-slate-400">Total expenses</p>
                    <p className="mt-1 text-xl font-semibold text-red-400">
                        ${totalExpenses.toFixed(2)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <p className="text-[10px] uppercase text-slate-400">Net cashflow</p>
                    <p
                        className={`mt-1 text-xl font-semibold ${
                            totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                    >
                        ${totalNet.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Month-by-month breakdown */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-2 text-sm font-semibold">Monthly breakdown</h3>

                {loading ? (
                    <p className="text-slate-400">Loading…</p>
                ) : monthSummaries.length === 0 ? (
                    <p className="text-slate-400">
                        No transactions in this period. Try a different range.
                    </p>
                ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                            <tr className="border-b border-slate-800 text-left text-slate-400">
                                <th className="py-2 pr-2">Month</th>
                                <th className="py-2 pr-2">Income</th>
                                <th className="py-2 pr-2">Expenses</th>
                                <th className="py-2 pr-2">Net</th>
                            </tr>
                            </thead>
                            <tbody>
                            {monthSummaries.map(m => (
                                <tr
                                    key={m.key}
                                    className="border-b border-slate-900 last:border-b-0"
                                >
                                    <td className="py-1 pr-2 text-slate-100">{m.label}</td>
                                    <td className="py-1 pr-2 text-emerald-400">
                                        ${m.income.toFixed(2)}
                                    </td>
                                    <td className="py-1 pr-2 text-red-400">
                                        ${m.expenses.toFixed(2)}
                                    </td>
                                    <td
                                        className={`py-1 pr-2 ${
                                            m.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        }`}
                                    >
                                        ${m.net.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}
