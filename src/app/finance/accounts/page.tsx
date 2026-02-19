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
    category_id: string | null;
    person: string | null;
    note: string | null;
    name: string | null;
    is_transfer?: boolean;
    transfer_group_id?: string | null;
};

type Category = {
    id: string;
    name: string;
    kind: 'group' | 'category';
    parent_id: string | null;
    type: 'income' | 'expense' | 'transfer' | null;
};

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<TxRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    
    // Selected account state
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    
    // Transaction form state
    const [editingTxId, setEditingTxId] = useState<string | null>(null);
    const [showAddTransaction, setShowAddTransaction] = useState(false);
    const [txDate, setTxDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [txAccountId, setTxAccountId] = useState<string>('');
    const [txCategoryId, setTxCategoryId] = useState<string>('');
    const [txCategoryName, setTxCategoryName] = useState<string>('');
    const [txType, setTxType] = useState<'expense' | 'income'>('expense');
    const [txAmount, setTxAmount] = useState<string>('');
    const [txPerson, setTxPerson] = useState<string>('Malik');
    const [txNote, setTxNote] = useState<string>('');

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

            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

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
                { data: categoriesData, error: categoriesError },
                { data: txData, error: txError },
            ] = await Promise.all([
                // 🔹 Include starting_balance - filter by user_id
                supabase.from('accounts').select('id, name, type, starting_balance').eq('user_id', user.id),
                supabase.from('categories').select('id, name, kind, parent_id, type').eq('user_id', user.id).order('name'),
                supabase
                    .from('transactions')
                    .select('id, date, amount, account_id, category_id, person, note, name, is_transfer, transfer_group_id')
                    .eq('user_id', user.id)
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
            
            if (categoriesError) {
                console.error(categoriesError);
            }

            setAccounts((accountsData as Account[]) ?? []);
            setCategories((categoriesData as Category[]) ?? []);
            setTransactions((txData as TxRow[]) ?? []);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Accounts load failed', err);
            setNotification('Error loading data. Check console/logs.');
            setLoading(false);
        });
    }, [monthDate]);

    // Filter transactions by selected account
    const filteredTransactions = useMemo(() => {
        if (!selectedAccountId) return [];
        return transactions.filter(tx => tx.account_id === selectedAccountId);
    }, [transactions, selectedAccountId]);
    
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
    
    // Get selected account details
    const selectedAccount = selectedAccountId 
        ? accounts.find(acc => acc.id === selectedAccountId)
        : null;
    
    // When account is selected, pre-populate transaction form
    useEffect(() => {
        if (selectedAccountId && !txAccountId) {
            setTxAccountId(selectedAccountId);
        }
    }, [selectedAccountId, txAccountId]);

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
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setNotification('You must be logged in to create accounts.');
                return;
            }

            setNotification(null);
            setActionLoadingId('new');

            const { data, error } = await supabase
                .from('accounts')
                .insert({
                    name: newAccountName.trim(),
                    type: newAccountType || null,
                    starting_balance: startingBalanceValue,
                    user_id: user.id,
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
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setNotification('You must be logged in to update accounts.');
                return;
            }

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
                .eq('user_id', user.id) // Ensure user can only update their own accounts
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
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setNotification('You must be logged in to delete accounts.');
                return;
            }

            setNotification(null);
            setActionLoadingId(accountId);

            const { error } = await supabase
                .from('accounts')
                .delete()
                .eq('id', accountId)
                .eq('user_id', user.id); // Ensure user can only delete their own accounts

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
    
    const findOrCreateCategory = async (categoryNameInput: string, type: 'expense' | 'income'): Promise<string | null> => {
        if (!categoryNameInput.trim()) return null;
        
        const trimmedName = categoryNameInput.trim();
        
        // First, try to find existing category
        const existingCategory = categories.find(
            c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.type === type
        );
        
        if (existingCategory) {
            return existingCategory.id;
        }
        
        // Category doesn't exist, create it
        try {
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setNotification('You must be logged in to create categories.');
                return null;
            }

            const { data, error } = await supabase
                .from('categories')
                .insert({
                    name: trimmedName,
                    type: type,
                    kind: 'category',
                    parent_id: null, // Will be a standalone category
                    user_id: user.id,
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error creating category:', error);
                setNotification(`Error creating category: ${error.message}`);
                return null;
            }
            
            // Add to local state
            setCategories(prev => [...prev, data as Category]);
            setNotification(`Created new category: "${trimmedName}"`);
            
            return data.id;
        } catch (error) {
            console.error('Error creating category:', error);
            setNotification('Error creating category. Check console/logs.');
            return null;
        }
    };
    
    const handleEditTransaction = (tx: TxRow) => {
        setEditingTxId(tx.id);
        setTxDate(tx.date.slice(0, 10));
        setTxAccountId(tx.account_id ?? '');
        setTxCategoryId(tx.category_id ?? '');
        const cat = categories.find(c => c.id === tx.category_id);
        setTxCategoryName(cat?.name ?? '');
        setTxType(tx.amount >= 0 ? 'income' : 'expense');
        setTxAmount(Math.abs(tx.amount).toString());
        setTxPerson(tx.person ?? 'Malik');
        setTxNote(tx.note ?? '');
        setShowAddTransaction(true);
        setNotification(null);
    };

    const handleCancelEditTransaction = () => {
        setEditingTxId(null);
        setShowAddTransaction(false);
        setTxDate(new Date().toISOString().slice(0, 10));
        setTxAccountId(selectedAccountId ?? '');
        setTxCategoryId('');
        setTxCategoryName('');
        setTxType('expense');
        setTxAmount('');
        setTxPerson('Malik');
        setTxNote('');
    };

    const handleDeleteTransaction = async (id: string) => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) {
            setNotification('Transaction not found.');
            return;
        }

        const ok = window.confirm(
            tx.is_transfer
                ? 'Delete this transfer? This will delete both transactions in the transfer.'
                : 'Delete this transaction?'
        );
        if (!ok) return;

        setNotification(null);

        if (tx.is_transfer && tx.transfer_group_id) {
            const transferGroup = transactions.filter(
                t => t.transfer_group_id === tx.transfer_group_id && t.is_transfer
            );
            if (transferGroup.length > 0) {
                const { error } = await supabase
                    .from('transactions')
                    .delete()
                    .in('id', transferGroup.map(t => t.id));

                if (error) {
                    console.error(error);
                    setNotification('Error deleting transfer. Check console/logs.');
                    return;
                }
                setTransactions(prev => prev.filter(t => !transferGroup.some(tg => tg.id === t.id)));
                setNotification('Transfer deleted.');
                return;
            }
        }

        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) {
            console.error(error);
            setNotification('Error deleting transaction. Check console/logs.');
            return;
        }

        setTransactions(prev => prev.filter(t => t.id !== id));
        setNotification('Transaction deleted.');
    };

    const handleAddTransaction = async (e: FormEvent, addAnother: boolean = false) => {
        e.preventDefault();
        
        const numAmount = Number(txAmount);
        if (!numAmount || !txAccountId) {
            setNotification('Please fill in all required fields.');
            return;
        }
        
        // Find or create category if categoryName is provided
        let finalCategoryId: string | null = txCategoryId || null;
        if (txCategoryName && !txCategoryId) {
            finalCategoryId = await findOrCreateCategory(txCategoryName, txType);
            if (!finalCategoryId) {
                setNotification('Please select or create a category.');
                return;
            }
        } else if (!txCategoryId) {
            setNotification('Please select or enter a category.');
            return;
        }
        
        let finalAmount = numAmount;
        if (txType === 'expense' && numAmount > 0) {
            finalAmount = -Math.abs(numAmount);
        } else if (txType === 'income' && numAmount < 0) {
            finalAmount = Math.abs(numAmount);
        }
        
        setNotification(null);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setNotification('You must be logged in to save transactions.');
            return;
        }

        if (editingTxId) {
            // UPDATE existing transaction
            const { error } = await supabase
                .from('transactions')
                .update({
                    date: txDate,
                    account_id: txAccountId,
                    category_id: finalCategoryId,
                    amount: finalAmount,
                    person: txPerson,
                    note: txNote || null,
                })
                .eq('id', editingTxId);

            if (error) {
                console.error(error);
                setNotification('Error updating transaction. Check console/logs.');
                return;
            }

            setTransactions(prev =>
                prev.map(t =>
                    t.id === editingTxId
                        ? {
                              ...t,
                              date: txDate,
                              account_id: txAccountId,
                              category_id: finalCategoryId,
                              amount: finalAmount,
                              person: txPerson,
                              note: txNote || null,
                          }
                        : t
                )
            );
            setNotification('Transaction updated.');
            setEditingTxId(null);
            setShowAddTransaction(false);
            setTxDate(new Date().toISOString().slice(0, 10));
            setTxAccountId(selectedAccountId ?? '');
            setTxCategoryId('');
            setTxCategoryName('');
            setTxType('expense');
            setTxAmount('');
            setTxPerson('Malik');
            setTxNote('');
            return;
        }
        
        // INSERT new transaction
        const { error } = await supabase.from('transactions').insert({
            date: txDate,
            account_id: txAccountId,
            category_id: finalCategoryId,
            amount: finalAmount,
            person: txPerson,
            note: txNote || null,
            user_id: user.id,
        });
        
        if (error) {
            console.error(error);
            setNotification('Error saving transaction. Check console/logs.');
            return;
        }
        
        const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
        const startStr = startOfMonth.toISOString().slice(0, 10);
        const endStr = endOfMonth.toISOString().slice(0, 10);
        
        const { data: txData } = await supabase
            .from('transactions')
            .select('id, date, amount, account_id, category_id, person, note, name, is_transfer, transfer_group_id')
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lt('date', endStr);
        
        setTransactions((txData as TxRow[]) ?? []);
        setNotification('Transaction saved successfully.');
        
        if (addAnother) {
            setTxCategoryId('');
            setTxCategoryName('');
            setTxAmount('');
            setTxNote('');
            setTxType('expense');
        } else {
            setShowAddTransaction(false);
            setTxDate(new Date().toISOString().slice(0, 10));
            if (!selectedAccountId) setTxAccountId('');
            setTxCategoryId('');
            setTxCategoryName('');
            setTxType('expense');
            setTxAmount('');
            setTxPerson('Malik');
            setTxNote('');
        }
    };

    return (
        <section className="relative flex flex-col lg:flex-row gap-4 py-4 -mx-2 sm:mx-0">
            {notification && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-md border border-emerald-600 bg-emerald-950 px-4 py-2 text-xs text-emerald-200 shadow-lg">
                    {notification}
                </div>
            )}

            {/* Left sidebar - Accounts */}
            <aside className="w-full lg:w-72 flex-shrink-0 space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                    <h2 className="text-sm font-semibold mb-2">Accounts</h2>
                    <p className="text-[11px] text-slate-400 mb-2">
                        Net worth: <span className={netWorth >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{formatCurrency(netWorth)}</span>
                    </p>
                </div>

                {loading ? (
                    <p className="text-slate-400">Loading…</p>
                ) : accounts.length === 0 ? (
                    <p className="text-slate-400">
                        No accounts found. Add one below to get started.
                    </p>
                ) : (
                    <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                        {accounts.map(acc => {
                            const { signedBalance } = getAccountBalance(acc);
                            const isPositive = signedBalance >= 0;
                            const isEditing = editingAccountId === acc.id;
                            const isBusy = actionLoadingId === acc.id;
                            const isSelected = selectedAccountId === acc.id;

                            return (
                                <div
                                    key={acc.id}
                                    className={`rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                                        isSelected
                                            ? 'border-emerald-600 bg-emerald-950/50'
                                            : 'border-slate-800 bg-slate-950 hover:bg-slate-800/50'
                                    }`}
                                >
                                    {isEditing ? (
                                        <form
                                            onSubmit={e => handleSaveEdit(e, acc.id)}
                                            onClick={e => e.stopPropagation()}
                                            className="flex flex-col gap-2"
                                        >
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                                                placeholder="Account name"
                                            />
                                            <select
                                                value={editType}
                                                onChange={e => setEditType((e.target.value || '') as AccountType | '')}
                                                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                                            >
                                                {accountTypeOptions.map(t => (
                                                    <option key={t} value={t}>{formatAccountType(t)}</option>
                                                ))}
                                            </select>
                                            <input
                                                value={editStartingBalance}
                                                onChange={e => setEditStartingBalance(e.target.value)}
                                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                                                placeholder="Starting balance"
                                            />
                                            <div className="flex gap-2">
                                                <button type="submit" disabled={isBusy} className="flex-1 rounded-md border border-emerald-600 bg-emerald-900 px-2 py-1 text-[11px]">
                                                    {isBusy ? 'Saving…' : 'Save'}
                                                </button>
                                                <button type="button" onClick={cancelEditing} className="flex-1 rounded-md border border-slate-700 px-2 py-1 text-[11px]">
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div
                                            onClick={() => {
                                                setSelectedAccountId(acc.id);
                                                setTxAccountId(acc.id);
                                            }}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-slate-100 truncate">{acc.name}</div>
                                                <div className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {formatCurrency(signedBalance)}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditing(acc)}
                                                    className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAccount(acc.id)}
                                                    disabled={isBusy}
                                                    className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-950 disabled:opacity-50"
                                                >
                                                    Del
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Add new account */}
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
                        For credit cards, starting balance can be your current card balance.
                    </p>
                </div>
            </aside>

            {/* Main content - Transactions for selected account */}
            <main className="flex-1 min-w-0 space-y-4">
                {!selectedAccountId ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
                        <p className="text-slate-400 text-sm">Select an account from the sidebar to view and manage transactions.</p>
                    </div>
                ) : (
                    <>
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-semibold">
                                    {selectedAccount?.name} — Transactions
                                </h2>
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

                            {/* Transactions list with Edit/Delete */}
                            {filteredTransactions.length === 0 ? (
                                <p className="text-[11px] text-slate-400 py-4">
                                    No transactions for this account in {monthLabel}.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                    {[...filteredTransactions]
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map(tx => {
                                            const category = tx.category_id ? categories.find(c => c.id === tx.category_id) : null;
                                            const isPositive = tx.amount >= 0;
                                            return (
                                                <div
                                                    key={tx.id}
                                                    className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {formatCurrency(tx.amount)}
                                                            </span>
                                                            {category && <span className="text-slate-400">{category.name}</span>}
                                                            {tx.is_transfer && <span className="text-blue-400 text-[10px]">↔ Transfer</span>}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                                            {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            {tx.name && ` • ${tx.name}`}
                                                            {tx.person && ` • ${tx.person}`}
                                                        </div>
                                                        {tx.note && <div className="text-[10px] text-slate-500 mt-0.5">{tx.note}</div>}
                                                    </div>
                                                    <div className="flex gap-2 flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditTransaction(tx)}
                                                            className="rounded px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-amber-400"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteTransaction(tx.id)}
                                                            className="rounded px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-red-400"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}

                            {/* Add Transaction */}
                            <div className="mt-4 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingTxId) {
                                            handleCancelEditTransaction();
                                        } else {
                                            setShowAddTransaction(prev => !prev);
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 rounded-md border border-amber-500 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
                                >
                                    {editingTxId ? (
                                        <>Cancel Edit</>
                                    ) : showAddTransaction ? (
                                        <>− Hide form</>
                                    ) : (
                                        <>+ Add Transaction</>
                                    )}
                                </button>
                    
                                {showAddTransaction && (
                        <form onSubmit={(e) => handleAddTransaction(e, false)} className="space-y-2 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Date</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={txDate}
                                        onChange={e => setTxDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Account</label>
                                    <select
                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={txAccountId}
                                        onChange={e => setTxAccountId(e.target.value)}
                                        required
                                    >
                                        <option value="">Select</option>
                                        {accounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                    {selectedAccountId && (
                                        <p className="text-[9px] text-slate-500 mt-0.5">
                                            Pre-filled from selected account
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Type</label>
                                    <select
                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={txType}
                                        onChange={e => {
                                            setTxType(e.target.value as 'expense' | 'income');
                                            if (txAmount) {
                                                const numAmount = Number(txAmount);
                                                if (e.target.value === 'expense' && numAmount > 0) {
                                                    setTxAmount('-' + Math.abs(numAmount).toString());
                                                } else if (e.target.value === 'income' && numAmount < 0) {
                                                    setTxAmount(Math.abs(numAmount).toString());
                                                }
                                            }
                                        }}
                                    >
                                        <option value="expense">⬇️ Expense</option>
                                        <option value="income">⬆️ Income</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Category</label>
                                    <input
                                        type="text"
                                        list={`category-list-accounts-${txType}`}
                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={txCategoryName || (txCategoryId ? categories.find(c => c.id === txCategoryId)?.name || '' : '')}
                                        onChange={async (e) => {
                                            const inputValue = e.target.value;
                                            setTxCategoryName(inputValue);
                                            
                                            // Try to find matching category
                                            const matchingCategory = categories.find(
                                                c => c.name.toLowerCase() === inputValue.toLowerCase() && c.type === txType
                                            );
                                            
                                            if (matchingCategory) {
                                                setTxCategoryId(matchingCategory.id);
                                            } else {
                                                setTxCategoryId(''); // Will create new category on save
                                            }
                                        }}
                                        placeholder="Type or select category..."
                                        required
                                    />
                                    <datalist id={`category-list-accounts-${txType}`}>
                                        {(() => {
                                            // Organize categories into hierarchy
                                            const groups = categories.filter(c => c.kind === 'group' && c.type === txType);
                                            const subcategories = categories.filter(c => c.kind === 'category' && c.parent_id && c.type === txType);
                                            const standalone = categories.filter(c => c.kind === 'category' && !c.parent_id && c.type === txType);
                                            
                                            const options: React.ReactElement[] = [];
                                            
                                            // Add groups with their subcategories
                                            groups.forEach(group => {
                                                const groupSubcats = subcategories.filter(sc => sc.parent_id === group.id);
                                                if (groupSubcats.length > 0) {
                                                    groupSubcats.forEach(subcat => {
                                                        options.push(
                                                            <option key={subcat.id} value={subcat.name}>
                                                                {group.name} — {subcat.name}
                                                            </option>
                                                        );
                                                    });
                                                }
                                            });
                                            
                                            // Add standalone categories
                                            standalone.forEach(cat => {
                                                options.push(
                                                    <option key={cat.id} value={cat.name}>
                                                        {cat.name}
                                                    </option>
                                                );
                                            });
                                            
                                            return options;
                                        })()}
                                    </datalist>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={txAmount}
                                        onChange={e => setTxAmount(e.target.value)}
                                        placeholder={txType === 'expense' ? '-45.23' : '45.23'}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Person</label>
                                    <select
                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={txPerson}
                                        onChange={e => setTxPerson(e.target.value)}
                                    >
                                        <option value="Malik">Malik</option>
                                        <option value="Mikia">Mikia</option>
                                        <option value="Both">Both</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] text-slate-400 mb-1">Note (optional)</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                    value={txNote}
                                    onChange={e => setTxNote(e.target.value)}
                                    placeholder="Optional note"
                                />
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                                {!editingTxId && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleAddTransaction(e, true)}
                                        className="flex-1 rounded-md border border-amber-400 bg-amber-950 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-900"
                                    >
                                        Save & Add Another
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="flex-1 rounded-md bg-amber-400 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-300"
                                >
                                    {editingTxId ? 'Update Transaction' : 'Save Transaction'}
                                </button>
                            </div>
                        </form>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </section>
    );
}
