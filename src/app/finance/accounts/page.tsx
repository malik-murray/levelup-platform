'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import {
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { supabase } from '@auth/supabaseClient';
import { learnMerchantMappingFromUserCategory } from '@/lib/financial-concierge/categoryEngine';
import {
    ACCOUNT_GROUP_LABELS,
    ACCOUNT_GROUP_ORDER,
    ACCOUNT_LIQUIDITY_COLORS,
    ACCOUNT_LIQUIDITY_HINTS,
    ACCOUNT_LIQUIDITY_LABELS,
    ACCOUNT_LIQUIDITY_ORDER,
    defaultLiquidityForType,
    getAccountBalanceDetails,
    getAccountGroup,
    getAccountGroupIcon,
    type AccountGroup,
    type AccountLiquidity,
    type AccountType,
} from '@/lib/finance/accountBalances';
import {
    loadAccountLiquidityMap,
    resolveAccountLiquidity,
    saveAccountLiquidity,
} from '@/lib/finance/accountLiquidity';

type Account = {
    id: string;
    name: string;
    type: AccountType | null;
    starting_balance: number | null;
    plaid_account_id?: string | null;
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
    const [allTimeNetByAccountId, setAllTimeNetByAccountId] = useState<Map<string, number>>(
        () => new Map()
    );
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
    const [pieMode, setPieMode] = useState<'group' | 'account' | 'liquidity'>('group');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<AccountGroup>>(() => new Set());
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [liquidityByAccountId, setLiquidityByAccountId] = useState<
        Record<string, AccountLiquidity>
    >({});
    const [editLiquidity, setEditLiquidity] = useState<AccountLiquidity | ''>('');
    const [newLiquidity, setNewLiquidity] = useState<AccountLiquidity | ''>('');

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
                { data: allTxAmounts, error: allTxError },
                liquidityMap,
            ] = await Promise.all([
                // 🔹 Include balances - filter by user_id
                supabase
                    .from('accounts')
                    .select('id, name, type, starting_balance, plaid_account_id')
                    .eq('user_id', user.id),
                supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .eq('user_id', user.id)
                    .eq('is_archived', false)
                    .order('name'),
                supabase
                    .from('transactions')
                    .select('id, date, amount, account_id, category_id, person, note, name, is_transfer, transfer_group_id')
                    .eq('user_id', user.id)
                    .is('removed_at', null)
                    .gte('date', startStr)
                    .lt('date', endStr),
                // All-time amounts for manual-account balance (starting + all txs).
                // Plaid accounts use current_balance instead and ignore this sum.
                supabase
                    .from('transactions')
                    .select('account_id, amount')
                    .eq('user_id', user.id)
                    .is('removed_at', null),
                loadAccountLiquidityMap(supabase, user.id),
            ]);

            if (accountsError) {
                console.error(accountsError);
                setNotification('Error loading accounts. Check console/logs.');
            }

            if (txError) {
                console.error(txError);
                setNotification('Error loading transactions. Check console/logs.');
            }

            if (allTxError) {
                console.error(allTxError);
            }
            
            if (categoriesError) {
                console.error(categoriesError);
            }

            setAccounts((accountsData as Account[]) ?? []);
            setCategories((categoriesData as Category[]) ?? []);
            setTransactions((txData as TxRow[]) ?? []);
            setLiquidityByAccountId(liquidityMap);

            const allTimeMap = new Map<string, number>();
            for (const row of allTxAmounts || []) {
                if (!row.account_id) continue;
                allTimeMap.set(
                    row.account_id,
                    (allTimeMap.get(row.account_id) ?? 0) + Number(row.amount)
                );
            }
            setAllTimeNetByAccountId(allTimeMap);
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
    
    // Net change this month per account (for month activity, not balance)
    const netChangeByAccountId = useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach(tx => {
            if (!tx.account_id) return;
            const prev = map.get(tx.account_id) ?? 0;
            map.set(tx.account_id, prev + Number(tx.amount));
        });
        return map;
    }, [transactions]);

    const getAccountBalance = (acc: Account) =>
        getAccountBalanceDetails(
            acc.type,
            acc.starting_balance,
            allTimeNetByAccountId.get(acc.id) ?? 0,
            // Plaid sync stores the institution's current balance in starting_balance.
            // Using it as liveBalance prevents double-counting month/all-time txs on top.
            { liveBalance: acc.plaid_account_id ? acc.starting_balance : null }
        );

    const accountsByGroup = useMemo(() => {
        return ACCOUNT_GROUP_ORDER.map(group => {
            const groupAccounts = accounts
                .filter(a => getAccountGroup(a.type) === group)
                .map(acc => {
                    const bal = getAccountBalance(acc);
                    const balanceToShow =
                        group === 'credit' ? bal.displayBalance : bal.signedBalance;
                    return { acc, balanceToShow };
                })
                .sort((a, b) => Math.abs(b.balanceToShow) - Math.abs(a.balanceToShow));
            const groupTotal = groupAccounts.reduce((s, r) => s + r.balanceToShow, 0);
            return {
                group,
                label: ACCOUNT_GROUP_LABELS[group],
                accounts: groupAccounts,
                groupTotal,
            };
        }).filter(g => g.accounts.length > 0);
    }, [accounts, allTimeNetByAccountId]);

    const toggleGroupCollapsed = (group: AccountGroup) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

    const netWorth = useMemo(() => {
        return accounts.reduce((sum, acc) => {
            return sum + getAccountBalance(acc).signedBalance;
        }, 0);
    }, [accounts, allTimeNetByAccountId]);

    const GROUP_COLORS: Record<AccountGroup, string> = {
        spending: '#34d399',
        savings: '#fbbf24',
        investing: '#818cf8',
        credit: '#f87171',
    };

    const ACCOUNT_PALETTE = [
        '#34d399',
        '#2dd4bf',
        '#38bdf8',
        '#818cf8',
        '#a78bfa',
        '#fbbf24',
        '#fb923c',
        '#f472b6',
        '#e879f9',
        '#94a3b8',
    ];

    type PieSlice = {
        id: string;
        name: string;
        value: number;
        color: string;
        group?: AccountGroup;
        accountId?: string;
    };

    const accountBreakdownSlices = useMemo((): PieSlice[] => {
        const rows = accounts
            .map(acc => {
                const { signedBalance, displayBalance } = getAccountBalance(acc);
                const group = getAccountGroup(acc.type);
                // Assets: positive signed balance. Credit: show debt size as positive slice value.
                const value =
                    group === 'credit'
                        ? Math.abs(displayBalance)
                        : Math.max(0, signedBalance);
                return { acc, group, value, signedBalance };
            })
            .filter(r => r.value > 0.005);

        if (pieMode === 'group') {
            const byGroup = new Map<AccountGroup, number>();
            for (const row of rows) {
                byGroup.set(row.group, (byGroup.get(row.group) ?? 0) + row.value);
            }
            return ACCOUNT_GROUP_ORDER.filter(g => (byGroup.get(g) ?? 0) > 0).map(g => ({
                id: g,
                name: ACCOUNT_GROUP_LABELS[g],
                value: byGroup.get(g) ?? 0,
                color: GROUP_COLORS[g],
                group: g,
            }));
        }

        if (pieMode === 'liquidity') {
            const byLiq = new Map<AccountLiquidity, number>();
            for (const row of rows) {
                if (row.group === 'credit') continue;
                const tag = resolveAccountLiquidity(
                    row.acc.id,
                    row.acc.type,
                    liquidityByAccountId
                );
                if (!tag) continue;
                byLiq.set(tag, (byLiq.get(tag) ?? 0) + row.value);
            }
            return ACCOUNT_LIQUIDITY_ORDER.filter(t => (byLiq.get(t) ?? 0) > 0).map(t => ({
                id: t,
                name: ACCOUNT_LIQUIDITY_LABELS[t],
                value: byLiq.get(t) ?? 0,
                color: ACCOUNT_LIQUIDITY_COLORS[t],
            }));
        }

        const sorted = [...rows].sort((a, b) => b.value - a.value);
        const TOP_N = 8;
        const top = sorted.slice(0, TOP_N);
        const rest = sorted.slice(TOP_N);
        const slices: PieSlice[] = top.map((row, i) => ({
            id: row.acc.id,
            name: row.acc.name,
            value: row.value,
            color: ACCOUNT_PALETTE[i % ACCOUNT_PALETTE.length],
            group: row.group,
            accountId: row.acc.id,
        }));
        if (rest.length > 0) {
            slices.push({
                id: 'other',
                name: `Other (${rest.length})`,
                value: rest.reduce((s, r) => s + r.value, 0),
                color: '#64748b',
            });
        }
        return slices;
    }, [accounts, allTimeNetByAccountId, pieMode, liquidityByAccountId]);

    const breakdownTotal = useMemo(
        () => accountBreakdownSlices.reduce((s, slice) => s + slice.value, 0),
        [accountBreakdownSlices]
    );

    const getAccountLiquidity = (acc: Account): AccountLiquidity | null =>
        resolveAccountLiquidity(acc.id, acc.type, liquidityByAccountId);

    const liquiditySummary = useMemo(() => {
        const totals: Record<AccountLiquidity, number> = {
            liquid: 0,
            reserved: 0,
            locked: 0,
        };
        for (const acc of accounts) {
            if (getAccountGroup(acc.type) === 'credit') continue;
            const tag = getAccountLiquidity(acc);
            if (!tag) continue;
            const { signedBalance } = getAccountBalance(acc);
            if (signedBalance <= 0) continue;
            totals[tag] += signedBalance;
        }
        return totals;
    }, [accounts, allTimeNetByAccountId, liquidityByAccountId]);

    const creditDebtTotal = useMemo(() => {
        return accounts.reduce((sum, acc) => {
            if (getAccountGroup(acc.type) !== 'credit') return sum;
            return sum + Math.abs(getAccountBalance(acc).displayBalance);
        }, 0);
    }, [accounts, allTimeNetByAccountId]);

    const selectedAccount = selectedAccountId
        ? accounts.find(acc => acc.id === selectedAccountId)
        : null;

    useEffect(() => {
        if (selectedAccountId && !txAccountId) {
            setTxAccountId(selectedAccountId);
        }
    }, [selectedAccountId, txAccountId]);

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
                .select('id, name, type, starting_balance, plaid_account_id')
                .single();

            if (error) {
                console.error(error);
                setNotification('Error creating account.');
                return;
            }

            const created = data as Account;
            const liquidity =
                newLiquidity ||
                defaultLiquidityForType((newAccountType || null) as AccountType | null);
            if (liquidity) {
                const liqErr = await saveAccountLiquidity(
                    supabase,
                    user.id,
                    created.id,
                    liquidity
                );
                if (!liqErr.error) {
                    setLiquidityByAccountId(prev => ({
                        ...prev,
                        [created.id]: liquidity,
                    }));
                }
            }

            setAccounts(prev => [...prev, created]);
            setNewAccountName('');
            setNewAccountType('');
            setNewStartingBalance('');
            setNewLiquidity('');
            setShowAddAccount(false);
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
        // Prefill the *displayed* balance (what the user sees in the list), not raw starting_balance.
        // For manual accounts, save converts that back into starting_balance.
        const { displayBalance, signedBalance } = getAccountBalance(account);
        const shown =
            getAccountGroup(account.type) === 'credit' ? displayBalance : signedBalance;
        setEditStartingBalance(String(Number(shown.toFixed(2))));
        const resolved = resolveAccountLiquidity(
            account.id,
            account.type,
            liquidityByAccountId
        );
        setEditLiquidity(resolved ?? '');
        setNotification(null);
    };

    const cancelEditing = () => {
        setEditingAccountId(null);
        setEditName('');
        setEditType('');
        setEditStartingBalance('');
        setEditLiquidity('');
    };

    // 🔹 Save account edits
    const handleSaveEdit = async (e: FormEvent, accountId: string) => {
        e.preventDefault();
        if (!editName.trim()) {
            setNotification('Account name is required.');
            return;
        }

        const existing = accounts.find(a => a.id === accountId);
        if (!existing) {
            setNotification('Account not found.');
            return;
        }

        const desiredBalance =
            editStartingBalance.trim() === ''
                ? 0
                : Number(editStartingBalance.replace(/,/g, ''));

        if (Number.isNaN(desiredBalance)) {
            setNotification('Balance must be a valid number.');
            return;
        }

        // Plaid accounts use the live institution balance — don't let local edits fight sync.
        if (existing.plaid_account_id) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setNotification('You must be logged in to update accounts.');
                    return;
                }
                setActionLoadingId(accountId);
                const { data, error } = await supabase
                    .from('accounts')
                    .update({
                        name: editName.trim(),
                        type: editType || null,
                    })
                    .eq('id', accountId)
                    .eq('user_id', user.id)
                    .select('id, name, type, starting_balance, plaid_account_id')
                    .single();
                if (error) {
                    console.error(error);
                    setNotification('Error updating account.');
                    return;
                }
                setAccounts(prev =>
                    prev.map(acc => (acc.id === accountId ? (data as Account) : acc))
                );
                const liqErr = await saveAccountLiquidity(
                    supabase,
                    user.id,
                    accountId,
                    editLiquidity || null
                );
                if (!liqErr.error) {
                    setLiquidityByAccountId(prev => {
                        const next = { ...prev };
                        if (editLiquidity) next[accountId] = editLiquidity;
                        else delete next[accountId];
                        return next;
                    });
                }
                setNotification(
                    'Name/type saved. Balance for linked accounts comes from your bank sync.'
                );
                cancelEditing();
            } catch (err) {
                console.error(err);
                setNotification('Unexpected error updating account.');
            } finally {
                setActionLoadingId(null);
            }
            return;
        }

        // Manual accounts: user edits the displayed balance. Persist as starting so that
        // starting + all-time tx net equals what they typed.
        const netChange = allTimeNetByAccountId.get(accountId) ?? 0;
        let startingBalanceValue: number;
        if ((editType || existing.type) === 'credit') {
            // display is typically 0 or negative (amount owed as -debt).
            // debt = max(0, starting) - netChange  =>  starting = debt + netChange
            const debt = Math.max(0, -desiredBalance);
            startingBalanceValue = debt + netChange;
        } else {
            startingBalanceValue = desiredBalance - netChange;
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
                .select('id, name, type, starting_balance, plaid_account_id')
                .single();

            if (error) {
                console.error(error);
                setNotification('Error updating account.');
                return;
            }

            setAccounts(prev =>
                prev.map(acc => (acc.id === accountId ? (data as Account) : acc))
            );
            const liqErr = await saveAccountLiquidity(
                supabase,
                user.id,
                accountId,
                editLiquidity || null
            );
            if (!liqErr.error) {
                setLiquidityByAccountId(prev => {
                    const next = { ...prev };
                    if (editLiquidity) next[accountId] = editLiquidity;
                    else delete next[accountId];
                    return next;
                });
            }
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
        
        const needsReview = categories.find(
            c =>
                c.kind === 'category' &&
                c.type === 'expense' &&
                c.name.toLowerCase() === 'needs review'
        );
        if (needsReview) {
            setNotification(
                `Category "${trimmedName}" is outside the 20-category master list. Routing to Needs Review.`
            );
            return needsReview.id;
        }
        setNotification('Category not found in the 20-category master list.');
        return null;
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
            const prior = transactions.find(t => t.id === editingTxId);
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

            if (finalCategoryId && prior) {
                void learnMerchantMappingFromUserCategory(supabase, {
                    userId: user.id,
                    categoryId: finalCategoryId,
                    name: prior.name,
                    note: (txNote || '').trim() || prior.note || null,
                });
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

        if (finalCategoryId) {
            void learnMerchantMappingFromUserCategory(supabase, {
                userId: user.id,
                categoryId: finalCategoryId,
                name: null,
                note: (txNote || '').trim() || null,
            });
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
            <aside className="flex w-full flex-shrink-0 flex-col lg:sticky lg:top-4 lg:h-[calc(100vh-5rem)] lg:w-80">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900 text-xs">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-100">Accounts</h2>
                            <p className="text-[11px] text-slate-400">
                                Net worth:{' '}
                                <span
                                    className={
                                        netWorth >= 0
                                            ? 'font-semibold text-emerald-400'
                                            : 'font-semibold text-red-400'
                                    }
                                >
                                    {formatCurrency(netWorth)}
                                </span>
                            </p>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
                                {ACCOUNT_LIQUIDITY_ORDER.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1">
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{
                                                background: ACCOUNT_LIQUIDITY_COLORS[tag],
                                            }}
                                        />
                                        {ACCOUNT_LIQUIDITY_LABELS[tag]}{' '}
                                        <span className="tabular-nums text-slate-400">
                                            {formatCurrency(liquiditySummary[tag])}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAddAccount(v => !v)}
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-800"
                        >
                            {showAddAccount ? 'Close' : '+ Add'}
                        </button>
                    </div>

                    {showAddAccount && (
                        <form
                            onSubmit={handleCreateAccount}
                            className="shrink-0 space-y-2 border-b border-slate-800 px-3 py-2.5"
                        >
                            <input
                                value={newAccountName}
                                onChange={e => setNewAccountName(e.target.value)}
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                placeholder="Account name"
                                autoFocus
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newAccountType}
                                    onChange={e => {
                                        const t = (e.target.value || '') as AccountType | '';
                                        setNewAccountType(t);
                                        if (!newLiquidity && t) {
                                            setNewLiquidity(defaultLiquidityForType(t) ?? '');
                                        }
                                    }}
                                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
                                >
                                    <option value="">Type</option>
                                    {accountTypeOptions.map(t => (
                                        <option key={t} value={t}>
                                            {formatAccountType(t)}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    value={newStartingBalance}
                                    onChange={e => setNewStartingBalance(e.target.value)}
                                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
                                    placeholder="Balance"
                                />
                            </div>
                            <select
                                value={newLiquidity}
                                onChange={e =>
                                    setNewLiquidity(
                                        (e.target.value || '') as AccountLiquidity | ''
                                    )
                                }
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
                            >
                                <option value="">Liquidity (optional)</option>
                                {ACCOUNT_LIQUIDITY_ORDER.map(tag => (
                                    <option key={tag} value={tag}>
                                        {ACCOUNT_LIQUIDITY_LABELS[tag]} —{' '}
                                        {ACCOUNT_LIQUIDITY_HINTS[tag]}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={actionLoadingId === 'new'}
                                className="w-full rounded-md bg-amber-400 px-2 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                            >
                                {actionLoadingId === 'new' ? 'Saving…' : 'Create account'}
                            </button>
                        </form>
                    )}

                    {loading ? (
                        <p className="p-3 text-slate-400">Loading…</p>
                    ) : accounts.length === 0 ? (
                        <p className="p-3 text-slate-400">No accounts yet. Tap + Add to create one.</p>
                    ) : (
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                            {accountsByGroup.map(
                                ({ group, label, accounts: groupAccounts, groupTotal }) => {
                                    const collapsed = collapsedGroups.has(group);
                                    const isCredit = group === 'credit';
                                    return (
                                        <div
                                            key={group}
                                            className="border-b border-slate-800/80 last:border-b-0"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleGroupCollapsed(group)}
                                                className="sticky top-0 z-[1] flex w-full items-center gap-2 bg-slate-900/95 px-3 py-1.5 backdrop-blur-sm hover:bg-slate-800/80"
                                            >
                                                <span className="w-3 text-[10px] text-slate-500">
                                                    {collapsed ? '▸' : '▾'}
                                                </span>
                                                <span className="text-[10px]">
                                                    {getAccountGroupIcon(group)}
                                                </span>
                                                <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                    {label}
                                                    <span className="ml-1 font-normal text-slate-600">
                                                        ({groupAccounts.length})
                                                    </span>
                                                </span>
                                                <span
                                                    className={`tabular-nums text-[10px] font-semibold ${
                                                        isCredit
                                                            ? groupTotal < 0
                                                                ? 'text-red-400'
                                                                : 'text-slate-500'
                                                            : groupTotal >= 0
                                                              ? 'text-slate-300'
                                                              : 'text-red-400'
                                                    }`}
                                                >
                                                    {formatCurrency(groupTotal)}
                                                </span>
                                            </button>

                                            {!collapsed && (
                                                <ul className="pb-0.5">
                                                    {groupAccounts.map(({ acc, balanceToShow }) => {
                                                        const isPositive = balanceToShow >= 0;
                                                        const isEditing = editingAccountId === acc.id;
                                                        const isBusy = actionLoadingId === acc.id;
                                                        const isSelected = selectedAccountId === acc.id;
                                                        const liquidityTag =
                                                            isCredit
                                                                ? null
                                                                : getAccountLiquidity(acc);

                                                        if (isEditing) {
                                                            return (
                                                                <li
                                                                    key={acc.id}
                                                                    className="border-t border-slate-800/60 bg-slate-950 px-3 py-2"
                                                                >
                                                                    <form
                                                                        onSubmit={e =>
                                                                            handleSaveEdit(e, acc.id)
                                                                        }
                                                                        className="flex flex-col gap-1.5"
                                                                    >
                                                                        <input
                                                                            value={editName}
                                                                            onChange={e =>
                                                                                setEditName(e.target.value)
                                                                            }
                                                                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                                            placeholder="Name"
                                                                        />
                                                                        <select
                                                                            value={editType}
                                                                            onChange={e =>
                                                                                setEditType(
                                                                                    (e.target.value ||
                                                                                        '') as
                                                                                        | AccountType
                                                                                        | ''
                                                                                )
                                                                            }
                                                                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                                        >
                                                                            {accountTypeOptions.map(t => (
                                                                                <option key={t} value={t}>
                                                                                    {formatAccountType(t)}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        {(editType || acc.type) !==
                                                                            'credit' && (
                                                                            <select
                                                                                value={editLiquidity}
                                                                                onChange={e =>
                                                                                    setEditLiquidity(
                                                                                        (e.target
                                                                                            .value ||
                                                                                            '') as
                                                                                            | AccountLiquidity
                                                                                            | ''
                                                                                    )
                                                                                }
                                                                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                                            >
                                                                                <option value="">
                                                                                    Liquidity…
                                                                                </option>
                                                                                {ACCOUNT_LIQUIDITY_ORDER.map(
                                                                                    tag => (
                                                                                        <option
                                                                                            key={tag}
                                                                                            value={tag}
                                                                                        >
                                                                                            {
                                                                                                ACCOUNT_LIQUIDITY_LABELS[
                                                                                                    tag
                                                                                                ]
                                                                                            }
                                                                                        </option>
                                                                                    )
                                                                                )}
                                                                            </select>
                                                                        )}
                                                                        <input
                                                                            value={editStartingBalance}
                                                                            onChange={e =>
                                                                                setEditStartingBalance(
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            disabled={Boolean(
                                                                                acc.plaid_account_id
                                                                            )}
                                                                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] disabled:opacity-60"
                                                                            placeholder="Current balance"
                                                                        />
                                                                        <div className="flex gap-1.5">
                                                                            <button
                                                                                type="submit"
                                                                                disabled={isBusy}
                                                                                className="flex-1 rounded bg-emerald-700 px-2 py-1 text-[10px] font-semibold text-white"
                                                                            >
                                                                                {isBusy ? '…' : 'Save'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={cancelEditing}
                                                                                className="flex-1 rounded border border-slate-700 px-2 py-1 text-[10px]"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </form>
                                                                </li>
                                                            );
                                                        }

                                                        return (
                                                            <li key={acc.id}>
                                                                <div
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onClick={() => {
                                                                        setSelectedAccountId(acc.id);
                                                                        setTxAccountId(acc.id);
                                                                    }}
                                                                    onKeyDown={e => {
                                                                        if (
                                                                            e.key === 'Enter' ||
                                                                            e.key === ' '
                                                                        ) {
                                                                            e.preventDefault();
                                                                            setSelectedAccountId(acc.id);
                                                                            setTxAccountId(acc.id);
                                                                        }
                                                                    }}
                                                                    className={`group flex cursor-pointer items-center gap-2 px-3 py-1 transition-colors ${
                                                                        isSelected
                                                                            ? 'bg-emerald-950/60'
                                                                            : 'hover:bg-slate-800/70'
                                                                    }`}
                                                                >
                                                                    <span
                                                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                                                            isSelected
                                                                                ? 'bg-emerald-400'
                                                                                : 'bg-slate-700'
                                                                        }`}
                                                                    />
                                                                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">
                                                                        {acc.name}
                                                                    </span>
                                                                    {liquidityTag && (
                                                                        <span
                                                                            title={
                                                                                ACCOUNT_LIQUIDITY_HINTS[
                                                                                    liquidityTag
                                                                                ]
                                                                            }
                                                                            className="shrink-0 rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wide"
                                                                            style={{
                                                                                color: ACCOUNT_LIQUIDITY_COLORS[
                                                                                    liquidityTag
                                                                                ],
                                                                                background: `${ACCOUNT_LIQUIDITY_COLORS[liquidityTag]}22`,
                                                                            }}
                                                                        >
                                                                            {liquidityTag === 'liquid'
                                                                                ? 'Liq'
                                                                                : liquidityTag ===
                                                                                    'reserved'
                                                                                  ? 'Res'
                                                                                  : 'Lck'}
                                                                        </span>
                                                                    )}
                                                                    <span
                                                                        className={`shrink-0 tabular-nums text-[11px] font-medium ${
                                                                            isCredit
                                                                                ? balanceToShow < 0
                                                                                    ? 'text-red-400'
                                                                                    : 'text-slate-500'
                                                                                : isPositive
                                                                                  ? 'text-emerald-400/90'
                                                                                  : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        {formatCurrency(balanceToShow)}
                                                                    </span>
                                                                    <div
                                                                        className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                startEditing(acc)
                                                                            }
                                                                            className="rounded px-1 py-0.5 text-[9px] text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                                                            title="Edit"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleDeleteAccount(acc.id)
                                                                            }
                                                                            disabled={isBusy}
                                                                            className="rounded px-1 py-0.5 text-[9px] text-red-400/80 hover:bg-red-950 hover:text-red-300 disabled:opacity-50"
                                                                            title="Delete"
                                                                        >
                                                                            Del
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                }
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content - Breakdown chart or selected account transactions */}
            <main className="flex-1 min-w-0 space-y-4">
                {!selectedAccountId ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold text-slate-100">
                                    Account breakdown
                                </h2>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                    Where your money sits across accounts
                                </p>
                            </div>
                            <div className="flex rounded-md border border-slate-700 bg-slate-950 p-0.5 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setPieMode('group')}
                                    className={`rounded px-2.5 py-1 ${
                                        pieMode === 'group'
                                            ? 'bg-slate-700 text-slate-100'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    By type
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPieMode('account')}
                                    className={`rounded px-2.5 py-1 ${
                                        pieMode === 'account'
                                            ? 'bg-slate-700 text-slate-100'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    By account
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPieMode('liquidity')}
                                    className={`rounded px-2.5 py-1 ${
                                        pieMode === 'liquidity'
                                            ? 'bg-slate-700 text-slate-100'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    By liquidity
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <p className="py-16 text-center text-sm text-slate-400">Loading…</p>
                        ) : accountBreakdownSlices.length === 0 ? (
                            <p className="py-16 text-center text-sm text-slate-400">
                                Add accounts with balances to see your breakdown.
                            </p>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                                <div className="relative mx-auto h-64 w-full max-w-md sm:h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={accountBreakdownSlices}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius="58%"
                                                outerRadius="88%"
                                                paddingAngle={2}
                                                stroke="rgba(15,23,42,0.85)"
                                                strokeWidth={2}
                                                onClick={(_, idx) => {
                                                    const slice = accountBreakdownSlices[idx];
                                                    if (!slice) return;
                                                    if (slice.accountId) {
                                                        setSelectedAccountId(slice.accountId);
                                                        setTxAccountId(slice.accountId);
                                                    }
                                                }}
                                            >
                                                {accountBreakdownSlices.map(slice => (
                                                    <Cell
                                                        key={slice.id}
                                                        fill={slice.color}
                                                        style={{
                                                            cursor: slice.accountId
                                                                ? 'pointer'
                                                                : 'default',
                                                        }}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    background: '#0f172a',
                                                    border: '1px solid #334155',
                                                    borderRadius: 8,
                                                    fontSize: 11,
                                                    color: '#e2e8f0',
                                                }}
                                                formatter={(value, _name, item) => {
                                                    const num = Number(value ?? 0);
                                                    const pct =
                                                        breakdownTotal > 0
                                                            ? ` (${((num / breakdownTotal) * 100).toFixed(1)}%)`
                                                            : '';
                                                    const payload = item?.payload as
                                                        | { name?: string }
                                                        | undefined;
                                                    return [
                                                        `${formatCurrency(num)}${pct}`,
                                                        payload?.name ?? '',
                                                    ];
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <p className="text-[10px] uppercase tracking-wide text-slate-500">
                                            Net worth
                                        </p>
                                        <p
                                            className={`text-lg font-bold sm:text-xl ${
                                                netWorth >= 0
                                                    ? 'text-emerald-400'
                                                    : 'text-red-400'
                                            }`}
                                        >
                                            {formatCurrency(netWorth)}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs">
                                    {accountBreakdownSlices.map(slice => {
                                        const pct =
                                            breakdownTotal > 0
                                                ? (slice.value / breakdownTotal) * 100
                                                : 0;
                                        return (
                                            <button
                                                key={slice.id}
                                                type="button"
                                                disabled={!slice.accountId}
                                                onClick={() => {
                                                    if (!slice.accountId) return;
                                                    setSelectedAccountId(slice.accountId);
                                                    setTxAccountId(slice.accountId);
                                                }}
                                                className={`flex w-full items-center gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-2.5 py-2 text-left ${
                                                    slice.accountId
                                                        ? 'hover:border-slate-600 hover:bg-slate-900'
                                                        : 'cursor-default'
                                                }`}
                                            >
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ background: slice.color }}
                                                />
                                                <span className="min-w-0 flex-1 truncate text-slate-200">
                                                    {slice.group
                                                        ? `${getAccountGroupIcon(slice.group)} `
                                                        : ''}
                                                    {slice.name}
                                                </span>
                                                <span className="shrink-0 tabular-nums text-slate-400">
                                                    {pct.toFixed(0)}%
                                                </span>
                                                <span className="shrink-0 tabular-nums font-medium text-slate-100">
                                                    {formatCurrency(slice.value)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {creditDebtTotal > 0 &&
                                        !accountBreakdownSlices.some(s => s.group === 'credit') && (
                                            <p className="pt-1 text-[10px] text-slate-500">
                                                Credit cards owed:{' '}
                                                <span className="text-red-400">
                                                    {formatCurrency(creditDebtTotal)}
                                                </span>
                                            </p>
                                        )}
                                    <p className="pt-2 text-[10px] text-slate-500">
                                        Select an account in the sidebar (or a slice) to view
                                        transactions.
                                    </p>
                                </div>
                            </div>
                        )}
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
                                                            {(category || tx.is_transfer) && (
                                                                <span className="text-slate-400">
                                                                    {category?.name ??
                                                                        (tx.is_transfer ? 'Transfer' : '')}
                                                                </span>
                                                            )}
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
                                                c =>
                                                    c.name.toLowerCase() === inputValue.toLowerCase() &&
                                                    (c.type === txType || c.type === 'transfer')
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
                                            const groups = categories.filter(
                                                c =>
                                                    c.kind === 'group' &&
                                                    (c.type === txType || c.type === 'transfer')
                                            );
                                            const subcategories = categories.filter(
                                                c =>
                                                    c.kind === 'category' &&
                                                    c.parent_id &&
                                                    (c.type === txType || c.type === 'transfer')
                                            );
                                            const standalone = categories.filter(
                                                c =>
                                                    c.kind === 'category' &&
                                                    !c.parent_id &&
                                                    (c.type === txType || c.type === 'transfer')
                                            );
                                            
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
