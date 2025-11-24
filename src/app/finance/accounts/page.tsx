'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';

type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other';

type Account = {
    id: string;
    name: string;
    type: AccountType | null;
    starting_balance: number | null;
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

    // New UI state for CRUD
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState<AccountType | ''>('');
    const [newStartingBalance, setNewStartingBalance] = useState('');

    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editType, setEditType] = useState<AccountType | ''>('');
    const [editStartingBalance, setEditStartingBalance] = useState('');

    const [actionLoadingId, setActionLoadingId] = useState<string | 'new' | null>(null);

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

            const [
                { data: accountsData, error: accountsError },
                { data: txData, error: txError },
            ] = await Promise.all([
                // 🔹 Include starting_balance
                supabase.from('accounts').select('id, name, type, starting_balance'),
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

    // Helper: compute signed current balance for an account
    const getAccountBalance = (acc: Account) => {
        const netChange = netChangeByAccountId.get(acc.id) ?? 0;
        const starting = Number(acc.starting_balance ?? 0);
        const rawBalance = starting + netChange; // balance this month

        // 🔹 Credit accounts are liabilities: flip sign so spending shows negative
        const signedBalance = acc.type === 'credit' ? -rawBalance : rawBalance;

        return {
            starting,
            netChange,
            rawBalance,
            signedBalance,
        };
    };

    // 🔹 Net worth = sum of signed balances across accounts
    const netWorth = useMemo(() => {
        return accounts.reduce((sum, acc) => {
            const { signedBalance } = getAccountBalance(acc);
            return sum + signedBalance;
        }, 0);
    }, [accounts, netChangeByAccountId]);

    const totalNetChange = useMemo(
        () =>
            Array.from(netChangeByAccountId.values()).reduce(
                (sum, v) => sum + v,
                0
            ),
        [netChangeByAccountId]
    );

    const formatAccountType = (type: AccountType | null) => {
        if (!type) return 'Unspecified';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    // 🔹 Create new account
    const handleCreateAccount = async (e: FormEvent) => {
        e.preventDefault();
        if (!newAccountName.trim()) {
            setNotification('Account name is required.');
            return;
        }

        const startingBalanceValue =
            newStartingBalance.trim() === ''
                ? 0
                : Number(newStartingBalance.replace(/,/g, ''));

        if (Number.isNaN(startingBalanceValue)) {
            setNotification('Starting balance must be a valid number.');
            return;
        }

        try {
            setNotification(null);
            setActionLoadingId('new');

            const { data, error } = await supabase
                .from('accounts')
                .insert({
                    name: newAccountName.trim(),
                    type: newAccountType || null,
                    starting_balance: startingBalanceValue,
                })
                .select()
                .single();

            if (error) {
                console.error(error);
                setNotification('Error creating account.');
                return;
            }

            setAccounts(prev => [...prev, data as Account]);
            setNewAccountName('');
            setNewAccountType('');
            setNewStartingBalance('');
            setNotification('Account created.');
        } catch (err) {
            console.error(err);
            setNotification('Unexpected error creating account.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // 🔹 Start editing an account
    const startEditing = (account: Account) => {
        setEditingAccountId(account.id);
        setEditName(account.name);
        setEditType(account.type || '');
        setEditStartingBalance(
            account.starting_balance !== null && account.starting_balance !== undefined
                ? String(account.starting_balance)
                : ''
        );
        setNotification(null);
    };

    const cancelEditing = () => {
        setEditingAccountId(null);
        setEditName('');
        setEditType('');
        setEditStartingBalance('');
    };

    // 🔹 Save account edits
    const handleSaveEdit = async (e: FormEvent, accountId: string) => {
        e.preventDefault();
        if (!editName.trim()) {
            setNotification('Account name is required.');
            return;
        }

        const startingBalanceValue =
            editStartingBalance.trim() === ''
                ? 0
                : Number(editStartingBalance.replace(/,/g, ''));

        if (Number.isNaN(startingBalanceValue)) {
            setNotification('Starting balance must be a valid number.');
            return;
        }

        try {
            setNotification(null);
            setActionLoadingId(accountId);

            const { data, error } = await supabase
                .from('accounts')
                .update({
                    name: editName.trim(),
                    type: editType || null,
                    starting_balance: startingBalanceValue,
                })
                .eq('id', accountId)
                .select()
                .single();

            if (error) {
                console.error(error);
                setNotification('Error updating account.');
                return;
            }

            setAccounts(prev =>
                prev.map(acc => (acc.id === accountId ? (data as Account) : acc))
            );
            setNotification('Account updated.');
            cancelEditing();
        } catch (err) {
            console.error(err);
            setNotification('Unexpected error updating account.');
        } finally {
            setActionLoadingId(null);
        }
    };

    // 🔹 Delete account
    const handleDeleteAccount = async (accountId: string) => {
        const ok = window.confirm(
            'Delete this account? This will not delete existing transactions but they will no longer be linked to this account.'
        );
        if (!ok) return;

        try {
            setNotification(null);
            setActionLoadingId(accountId);

            const { error } = await supabase
                .from('accounts')
                .delete()
                .eq('id', accountId);

            if (error) {
                console.error(error);
                setNotification('Error deleting account.');
                return;
            }

            setAccounts(prev => prev.filter(acc => acc.id !== accountId));
            setNotification('Account deleted.');
        } catch (err) {
            console.error(err);
            setNotification('Unexpected error deleting account.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const accountTypeOptions: AccountType[] = [
        'checking',
        'savings',
        'credit',
        'cash',
        'investment',
        'other',
    ];

    return (
        <section className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Accounts</h2>
                    <p className="text-xs text-slate-400">
                        Track account balances, credit cards, and overall net worth.
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
                <h3 className="mb-2 text-sm font-semibold">Overview</h3>
                <p className="text-[11px] text-slate-400">
                    Net change across all accounts this month:{' '}
                    <span
                        className={
                            totalNetChange >= 0
                                ? 'text-emerald-400 font-semibold'
                                : 'text-red-400 font-semibold'
                        }
                    >
                        {formatCurrency(totalNetChange)}
                    </span>
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                    Net worth (assets minus credit card balances):{' '}
                    <span
                        className={
                            netWorth >= 0
                                ? 'text-emerald-400 font-semibold'
                                : 'text-red-400 font-semibold'
                        }
                    >
                        {formatCurrency(netWorth)}
                    </span>
                </p>
            </div>

            {/* Accounts list */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Accounts</h3>
                </div>

                {loading ? (
                    <p className="text-slate-400">Loading…</p>
                ) : accounts.length === 0 ? (
                    <p className="text-slate-400">
                        No accounts found. Add one below to get started.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {accounts.map(acc => {
                            const { starting, netChange, signedBalance } =
                                getAccountBalance(acc);
                            const isPositive = signedBalance >= 0;
                            const isEditing = editingAccountId === acc.id;
                            const isBusy = actionLoadingId === acc.id;

                            return (
                                <div
                                    key={acc.id}
                                    className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                                >
                                    {isEditing ? (
                                        <form
                                            onSubmit={e => handleSaveEdit(e, acc.id)}
                                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                                                <input
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                    placeholder="Account name"
                                                />
                                                <select
                                                    value={editType}
                                                    onChange={e =>
                                                        setEditType(
                                                            (e.target.value || '') as AccountType | ''
                                                        )
                                                    }
                                                    className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                >
                                                    <option value="">Select type</option>
                                                    {accountTypeOptions.map(t => (
                                                        <option key={t} value={t}>
                                                            {formatAccountType(t)}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    value={editStartingBalance}
                                                    onChange={e =>
                                                        setEditStartingBalance(e.target.value)
                                                    }
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                    placeholder="Starting balance"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={isBusy}
                                                    className="rounded-md border border-emerald-600 bg-emerald-900 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-800 disabled:opacity-50"
                                                >
                                                    {isBusy ? 'Saving…' : 'Save'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelEditing}
                                                    disabled={isBusy}
                                                    className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-medium text-slate-100">
                                                        {acc.name}
                                                    </div>
                                                    <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] uppercase tracking-wide text-slate-300">
                                                        {formatAccountType(acc.type)}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    Starting balance:{' '}
                                                    <span className="font-semibold text-slate-200">
                                                        {formatCurrency(starting)}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    Net change this month:{' '}
                                                    <span
                                                        className={`font-semibold ${
                                                            netChange >= 0
                                                                ? 'text-emerald-400'
                                                                : 'text-red-400'
                                                        }`}
                                                    >
                                                        {formatCurrency(netChange)}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    Current balance:{' '}
                                                    <span
                                                        className={`font-semibold ${
                                                            isPositive
                                                                ? 'text-emerald-400'
                                                                : 'text-red-400'
                                                        }`}
                                                    >
                                                        {formatCurrency(signedBalance)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => startEditing(acc)}
                                                    className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAccount(acc.id)}
                                                    disabled={isBusy}
                                                    className="rounded-md border border-red-700 bg-red-950 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900 disabled:opacity-50"
                                                >
                                                    {isBusy ? 'Deleting…' : 'Delete'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 🔹 Add new account */}
                <div className="mt-4 border-t border-slate-800 pt-4">
                    <h4 className="mb-2 text-[11px] font-semibold text-slate-200">
                        Add new account
                    </h4>
                    <form
                        onSubmit={handleCreateAccount}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                    >
                        <input
                            value={newAccountName}
                            onChange={e => setNewAccountName(e.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Account name (e.g. Chase Checking)"
                        />
                        <select
                            value={newAccountType}
                            onChange={e =>
                                setNewAccountType((e.target.value || '') as AccountType | '')
                            }
                            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value="">Account type</option>
                            {accountTypeOptions.map(t => (
                                <option key={t} value={t}>
                                    {formatAccountType(t)}
                                </option>
                            ))}
                        </select>
                        <input
                            value={newStartingBalance}
                            onChange={e => setNewStartingBalance(e.target.value)}
                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="Starting balance (e.g. 1250)"
                        />
                        <button
                            type="submit"
                            disabled={actionLoadingId === 'new'}
                            className="rounded-md bg-amber-400 px-3 py-1 text-[11px] font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                        >
                            {actionLoadingId === 'new' ? 'Adding…' : 'Add account'}
                        </button>
                    </form>
                    <p className="mt-1 text-[10px] text-slate-500">
                        For credit cards, starting balance can be your current card balance. New
                        spending will push this more negative and reduce your net worth.
                    </p>
                </div>
            </div>
        </section>
    );
}
