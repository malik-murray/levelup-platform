'use client';

import { useEffect, useMemo, useState, ChangeEvent } from 'react';
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

    // ✅ NEW: import state
    const [importing, setImporting] = useState(false);

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

    // 🔧 Helper: get related name from accounts/categories relation
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

    // load transactions for selected month
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            // don't wipe import messages unless it's specifically a load error
            // setNotification(null);

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

    // =========================================================
    // 🆕 CSV IMPORT LOGIC
    // =========================================================

    const normalizeDate = (raw: string): string => {
        const trimmed = raw.trim();
        if (!trimmed) return trimmed;

        // e.g. 03/15/2024
        if (trimmed.includes('/')) {
            const [m, d, y] = trimmed.split('/');
            if (y && m && d) {
                return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
        }

        // assume already YYYY-MM-DD or close enough
        return trimmed;
    };

    const normalizeAmount = (raw: string): number | null => {
        let val = raw.trim();
        if (!val) return null;

        let negative = false;

        // Handle parentheses for negatives: (123.45)
        if (val.startsWith('(') && val.endsWith(')')) {
            negative = true;
            val = val.slice(1, -1);
        }

        // Remove $ and commas
        val = val.replace(/[\$,]/g, '');

        const parsed = parseFloat(val);
        if (Number.isNaN(parsed)) return null;

        return negative ? -parsed : parsed;
    };

    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setNotification(null);

        try {
            const text = await file.text();

            const lines = text
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l.length > 0);

            if (lines.length < 2) {
                setNotification('CSV appears to be empty or missing data rows.');
                return;
            }

            const headerLine = lines[0];
            const headers = headerLine
                .split(',')
                .map(h => h.trim().toLowerCase());

            const dateIdx = headers.findIndex(h => h === 'date' || h === 'posting date');
            const descIdx = headers.findIndex(
                h =>
                    h === 'description' ||
                    h === 'details' ||
                    h === 'memo' ||
                    h === 'payee'
            );
            const amountIdx = headers.findIndex(
                h =>
                    h === 'amount' ||
                    h === 'transaction amount' ||
                    h === 'debit' ||
                    h === 'credit'
            );

            if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
                setNotification(
                    'Could not detect date/description/amount columns. Make sure your CSV has headers: date, description, amount.'
                );
                return;
            }

            const rowsToInsert: {
                date: string;
                amount: number;
                person: string;
                note: string | null;
                account_id: string | null;
                category_id: string | null;
            }[] = [];

            let skipped = 0;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];

                // naive split – fine for first version
                const cols = line.split(',');
                if (cols.length < headers.length) {
                    skipped++;
                    continue;
                }

                const rawDate = cols[dateIdx];
                const rawDesc = cols[descIdx];
                const rawAmount = cols[amountIdx];

                const date = normalizeDate(rawDate);
                const amount = normalizeAmount(rawAmount);

                if (!date || amount === null) {
                    skipped++;
                    continue;
                }

                rowsToInsert.push({
                    date,
                    amount,
                    person: rawDesc?.slice(0, 255) ?? '',
                    note: null,
                    account_id: null, // optional: wire to a selected account later
                    category_id: null, // optional: auto-categorize later
                });
            }

            if (rowsToInsert.length === 0) {
                setNotification(
                    'No valid rows found to import. Check your CSV format and try again.'
                );
                return;
            }

            const { error } = await supabase
                .from('transactions')
                .insert(rowsToInsert);

            if (error) {
                console.error('Import error:', error);
                setNotification('Error importing transactions. Check console/logs.');
                return;
            }

            setNotification(
                `Imported ${rowsToInsert.length} transactions${
                    skipped ? ` (skipped ${skipped} lines that looked invalid)` : ''
                }.`
            );

            // 🔄 Re-trigger the month load to show new data
            setMonthDate(prev => new Date(prev)); // clone to force useEffect rerun
        } catch (err) {
            console.error('Import failed:', err);
            setNotification('Error reading file. Make sure it is a CSV and try again.');
        } finally {
            setImporting(false);
            // clear file input so same file can be selected again if needed
            event.target.value = '';
        }
    };

    // =========================================================
    // RENDER
    // =========================================================

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

            {/* 🆕 CSV import panel */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase text-slate-400">
                            Import from bank statement
                        </p>
                        <p className="text-[11px] text-slate-300">
                            Upload a CSV (date, description, amount). We&apos;ll create
                            transactions automatically.
                        </p>
                    </div>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        disabled={importing}
                        className="text-[11px] file:mr-2 file:rounded-md file:border file:border-slate-700 file:bg-slate-800 file:px-2 file:py-1 file:text-[11px] file:text-slate-100 hover:file:bg-slate-700"
                    />
                </div>
                <p className="text-[10px] text-slate-500">
                    Tip: Export your bank statement as CSV with columns like:
                    <span className="font-mono"> date, description, amount</span>. You
                    can categorize and assign accounts later.
                </p>
            </div>

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
                        No transactions for {monthLabel}. Add one from the Home page or
                        import a statement above.
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
                                                ? 'text-emerald-400'
                                                : 'text-red-400'
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
