'use client';

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';

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
    accountId: string | null;
    categoryId: string | null;
    is_transfer: boolean;
    transfer_group_id: string | null;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    person: string;
    note: string | null;
    account_id: string | null;
    category_id: string | null;
    is_transfer: boolean;
    transfer_group_id: string | null;
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
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // ✅ NEW: import state
    const [importing, setImporting] = useState(false);

    // ✅ NEW: transfer form state
    const [showTransferForm, setShowTransferForm] = useState(false);
    const [transferFromAccount, setTransferFromAccount] = useState<string>('');
    const [transferToAccount, setTransferToAccount] = useState<string>('');
    const [transferAmount, setTransferAmount] = useState<string>('');
    const [transferNote, setTransferNote] = useState<string>('');
    const [transferDate, setTransferDate] = useState<string>(() =>
        new Date().toISOString().slice(0, 10)
    );
    const [creatingTransfer, setCreatingTransfer] = useState(false);

    // ✅ NEW: transaction form state
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [date, setDate] = useState<string>(() =>
        new Date().toISOString().slice(0, 10)
    );
    const [accountId, setAccountId] = useState<string>('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [amount, setAmount] = useState<string>('0');
    const [person, setPerson] = useState<string>('Malik');
    const [note, setNote] = useState<string>('');

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

    // Load accounts and categories
    useEffect(() => {
        const loadData = async () => {
            const [
                { data: accountsData, error: accountsError },
                { data: categoriesData, error: categoriesError },
            ] = await Promise.all([
                supabase.from('accounts').select('id, name').order('name'),
                supabase.from('categories').select('id, name, type').order('name'),
            ]);

            if (accountsError) {
                console.error('Error loading accounts:', accountsError);
            } else {
                setAccounts((accountsData as Account[]) ?? []);
            }

            if (categoriesError) {
                console.error('Error loading categories:', categoriesError);
            } else {
                setCategories((categoriesData as Category[]) ?? []);
            }
        };

        loadData();
    }, []);

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
          is_transfer,
          transfer_group_id,
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
                accountId: tx.account_id,
                categoryId: tx.category_id,
                is_transfer: tx.is_transfer ?? false,
                transfer_group_id: tx.transfer_group_id,
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

    // ✅ Filter out transfers from income/expense totals
    const totalIn = useMemo(
        () =>
            transactions
                .filter(tx => tx.amount > 0 && !tx.is_transfer)
                .reduce((sum, tx) => sum + tx.amount, 0),
        [transactions]
    );

    const totalOut = useMemo(
        () =>
            transactions
                .filter(tx => tx.amount < 0 && !tx.is_transfer)
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
        [transactions]
    );

    const net = totalIn - totalOut;

    // =========================================================
    // 🆕 TRANSACTION CRUD LOGIC
    // =========================================================

    const resetFormToDefault = () => {
        setDate(new Date().toISOString().slice(0, 10));
        setAccountId('');
        setCategoryId('');
        setAmount('0');
        setPerson('Malik');
        setNote('');
        setEditingId(null);
        setShowTransactionForm(false);
    };

    const handleEditTransaction = (tx: Transaction) => {
        if (tx.is_transfer) {
            setNotification('Transfers cannot be edited. Delete and recreate if needed.');
            return;
        }
        setEditingId(tx.id);
        setDate(tx.date.slice(0, 10));
        setAmount(tx.amount.toString());
        setPerson(tx.person);
        setNote(tx.note ?? '');
        setAccountId(tx.accountId ?? '');
        setCategoryId(tx.categoryId ?? '');
        setShowTransactionForm(true);
    };

    const handleCancelEdit = () => {
        resetFormToDefault();
    };

    const handleSaveTransaction = async (e: FormEvent) => {
        e.preventDefault();

        const numAmount = Number(amount);
        if (!numAmount || !accountId || !categoryId) {
            setNotification('Please fill in all required fields.');
            return;
        }

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
            setNotification('Transaction updated.');
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
            setNotification('Transaction saved.');
        }

        resetFormToDefault();
        // Reload transactions
        setMonthDate(prev => new Date(prev));
    };

    const handleDeleteTransaction = async (id: string) => {
        setNotification(null);

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

        setNotification('Transaction deleted.');
        // Reload transactions
        setMonthDate(prev => new Date(prev));
    };

    // =========================================================
    // 🆕 TRANSFER CREATION LOGIC
    // =========================================================

    const handleCreateTransfer = async (e: FormEvent) => {
        e.preventDefault();

        if (!transferFromAccount || !transferToAccount || !transferAmount) {
            setNotification('Please fill in all required fields.');
            return;
        }

        if (transferFromAccount === transferToAccount) {
            setNotification('From and To accounts must be different.');
            return;
        }

        const numAmount = parseFloat(transferAmount);
        if (Number.isNaN(numAmount) || numAmount <= 0) {
            setNotification('Amount must be a positive number.');
            return;
        }

        setCreatingTransfer(true);
        setNotification(null);

        try {
            // Generate a new UUID for the transfer group
            const transferGroupId = crypto.randomUUID();

            // Get account names for the person field
            const fromAccount = accounts.find(a => a.id === transferFromAccount);
            const toAccount = accounts.find(a => a.id === transferToAccount);
            const transferLabel = `Transfer: ${fromAccount?.name ?? 'Unknown'} → ${toAccount?.name ?? 'Unknown'}`;

            // Create two linked transactions
            const { error } = await supabase.from('transactions').insert([
                {
                    date: transferDate,
                    amount: -numAmount, // Negative: money leaving source account
                    person: transferLabel,
                    note: transferNote || null,
                    account_id: transferFromAccount,
                    category_id: null,
                    is_transfer: true,
                    transfer_group_id: transferGroupId,
                },
                {
                    date: transferDate,
                    amount: numAmount, // Positive: money entering destination account
                    person: transferLabel,
                    note: transferNote || null,
                    account_id: transferToAccount,
                    category_id: null,
                    is_transfer: true,
                    transfer_group_id: transferGroupId,
                },
            ]);

            if (error) {
                console.error('Transfer creation error:', error);
                setNotification('Error creating transfer. Check console/logs.');
                return;
            }

            setNotification(
                `Transfer created: ${fromAccount?.name} → ${toAccount?.name} ($${numAmount.toFixed(2)})`
            );

            // Reset form
            setTransferFromAccount('');
            setTransferToAccount('');
            setTransferAmount('');
            setTransferNote('');
            setTransferDate(new Date().toISOString().slice(0, 10));
            setShowTransferForm(false);

            // Reload transactions
            setMonthDate(prev => new Date(prev)); // clone to force useEffect rerun
        } catch (err) {
            console.error('Transfer creation failed:', err);
            setNotification('Error creating transfer. Check console/logs.');
        } finally {
            setCreatingTransfer(false);
        }
    };

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

            {/* 🆕 Transfer form */}
            {showTransferForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Create Account Transfer</h3>
                        <button
                            type="button"
                            onClick={() => setShowTransferForm(false)}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            ✕
                        </button>
                    </div>
                    <form onSubmit={handleCreateTransfer} className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                                <label className="block text-slate-300">Date</label>
                                <input
                                    type="date"
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={transferDate}
                                    onChange={e => setTransferDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-slate-300">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={transferAmount}
                                    onChange={e => setTransferAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                                <label className="block text-slate-300">From Account</label>
                                <select
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={transferFromAccount}
                                    onChange={e => setTransferFromAccount(e.target.value)}
                                    required
                                >
                                    <option value="">Select account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-slate-300">To Account</label>
                                <select
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={transferToAccount}
                                    onChange={e => setTransferToAccount(e.target.value)}
                                    required
                                >
                                    <option value="">Select account</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-slate-300">
                                Note (optional)
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={transferNote}
                                onChange={e => setTransferNote(e.target.value)}
                                placeholder="e.g. Paying off credit card"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={creatingTransfer}
                                className="flex-1 rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                            >
                                {creatingTransfer ? 'Creating...' : 'Create Transfer'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowTransferForm(false)}
                                className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 🆕 Transaction form */}
            {showTransactionForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                            {editingId ? 'Edit transaction' : 'Add transaction'}
                        </h3>
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-slate-400 hover:text-slate-200"
                        >
                            ✕
                        </button>
                    </div>
                    <form onSubmit={handleSaveTransaction} className="space-y-3 mt-3">
                        <div className="space-y-1">
                            <label className="block text-slate-300">Date</label>
                            <input
                                type="date"
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-slate-300">Account</label>
                            <select
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={accountId}
                                onChange={e => setAccountId(e.target.value)}
                                required
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
                                required
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
                                required
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
                                required
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
                        <div className="flex gap-2 mt-2">
                            <button
                                type="submit"
                                className="flex-1 rounded-md bg-amber-400 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                            >
                                {editingId ? 'Update transaction' : 'Save transaction'}
                            </button>
                            {editingId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="rounded-md border border-slate-600 py-2 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* 🆕 Action buttons */}
            {!showTransferForm && !showTransactionForm && (
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setShowTransactionForm(true)}
                        className="rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                    >
                        + Add Transaction
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowTransferForm(true)}
                        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                        + Create Transfer
                    </button>
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
                                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                                    tx.is_transfer
                                        ? 'border-blue-700 bg-slate-950'
                                        : 'border-slate-800 bg-slate-950'
                                }`}
                            >
                                <div>
                                    <div className="font-medium">
                                        {tx.is_transfer && (
                                            <span className="mr-1 text-blue-400">↔</span>
                                        )}
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
                                    {!tx.is_transfer && (
                                        <div className="flex gap-2 text-[10px] text-slate-400">
                                            <button
                                                type="button"
                                                onClick={() => handleEditTransaction(tx)}
                                                className="hover:text-amber-300"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTransaction(tx.id)}
                                                className="hover:text-red-400"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
