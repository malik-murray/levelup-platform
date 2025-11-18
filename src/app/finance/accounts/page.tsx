'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Account = {
    id: string;
    name: string;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    account_id: string | null;
};

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // Month state (same pattern as other pages)
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

    // Load accounts + this month's transactions
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

            const startStr = startOfMonth.toISOString().slice(0, 10);
            const endStr = endOfMonth.toISOString().slice(0, 10);

            const [{ data: accountsData, error: accountsError }, { data: txData, error: txError }] =
                await Promise.all([
                    supabase.from('accounts').select('id, name'),
                    supabase
                        .from('transactions')
                        .select('id, date, amount, account_id')
                        .gte('date', startStr)
                        .lt('date', endStr),
                ]);

            if (accountsError) {
                console.error(accountsError);
                setNotification('Error loading accounts. Check console/logs.');
            }

            if (txError) {
                console.error(txError);
                setNotification('Error loading transactions. Check console/logs.');
            }

            setAccounts((accountsData as Account[]) ?? []);
            setTransactions((txData as TxRow[]) ?? []);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Accounts load failed', err);
            setNotification('Error loading data. Check console/logs.');
            setLoading(false);
        });
    }, [monthDate]);

    // Net change this month per account (sum of tx amounts)
    const netChangeByAccountId = useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach(tx => {
            if (!tx.account_id) return;
            const prev = map.get(tx.account_id) ?? 0;
            map.set(tx.account_id, prev + Number(tx.amount));
        });
        return map;
    }, [transactions]);

    const totalNetChange = useMemo(
        () =>
            Array.from(netChangeByAccountId.values()).reduce(
                (sum, v) => sum + v,
                0
            ),
        [netChangeByAccountId]
    );

    return (
        <section className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Accounts</h2>
                    <p className="text-xs text-slate-400">
                        See how each account is changing this month.
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

            {/* Summary card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-2 text-sm font-semibold">This month by account</h3>
                <p className="text-[11px] text-slate-400">
                    Net change across all accounts:{' '}
                    <span
                        className={
                            totalNetChange >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'
                        }
                    >
            ${totalNetChange.toFixed(2)}
          </span>
                </p>
            </div>

            {/* Accounts list */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-2 text-sm font-semibold">Accounts</h3>

                {loading ? (
                    <p className="text-slate-400">Loading…</p>
                ) : accounts.length === 0 ? (
                    <p className="text-slate-400">
                        No accounts found. Add some in your database to see them here.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {accounts.map(acc => {
                            const netChange = netChangeByAccountId.get(acc.id) ?? 0;
                            const isPositive = netChange >= 0;

                            return (
                                <div
                                    key={acc.id}
                                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                                >
                                    <div>
                                        <div className="font-medium text-slate-100">{acc.name}</div>
                                        <div className="text-[11px] text-slate-400">
                                            Net change this month
                                        </div>
                                    </div>
                                    <div
                                        className={`text-xs font-semibold ${
                                            isPositive ? 'text-emerald-400' : 'text-red-400'
                                        }`}
                                    >
                                        {isPositive ? '+' : '-'}${Math.abs(netChange).toFixed(2)}
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
