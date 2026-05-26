'use client';

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';
import {
    learnMerchantMappingFromUserCategory,
    merchantKeyFromNameNote,
} from '@/lib/financial-concierge/categoryEngine';

type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other';

type Account = {
    id: string;
    name: string;
};

type Category = {
    id: string;
    name: string;
    kind: 'group' | 'category';
    parent_id: string | null;
    type: 'income' | 'expense' | 'transfer' | string | null;
};

type Transaction = {
    id: string;
    date: string;
    amount: number;
    name: string | null;
    person: string;
    note: string | null;
    account: string | null;
    category: string | null;
    accountId: string | null;
    categoryId: string | null;
    is_transfer: boolean;
    transfer_group_id: string | null;
    pending: boolean;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    name: string | null;
    person: string;
    note: string | null;
    account_id: string | null;
    category_id: string | null;
    is_transfer: boolean;
    transfer_group_id: string | null;
    pending?: boolean;
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
    const categoryAllowedForTxType = (
        categoryType: Category['type'],
        txType: 'expense' | 'income'
    ) => categoryType === txType || categoryType === 'transfer';

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);

    // ✅ NEW: import state
    const [importing, setImporting] = useState(false);
    
    // Import preview state
    type PendingTransaction = {
        rawLine: string;
        date: string;
        description: string;
        amount: number;
        categoryId?: string | null;
        categoryName?: string; // For typed category names
        isAddingCategory?: boolean;
        selected: boolean;
        isTransfer?: boolean;
        transferToAccountId?: string | null;
        // AI suggestion state
        suggestedCategoryId?: string | null;
        suggestedCategoryName?: string | null;
        suggestionConfidence?: number;
        suggestionReasoning?: string;
        isSuggesting?: boolean;
        suggestionError?: string | null;
        // Duplicate detection state
        isDuplicate?: boolean;
        existingTransactionId?: string;
        duplicateChecked?: boolean;
    };
    const [pendingImportTransactions, setPendingImportTransactions] = useState<PendingTransaction[]>([]);
    const [importAccountId, setImportAccountId] = useState<string>('');

    // ✅ NEW: transaction form state
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [showBulkTransaction, setShowBulkTransaction] = useState(false);
    const [transactionType, setTransactionType] = useState<'transaction' | 'transfer'>('transaction');
    const [expenseIncomeType, setExpenseIncomeType] = useState<'expense' | 'income'>('expense');
    
    // Transfer-specific state (used when transactionType === 'transfer')
    const [transferFromAccount, setTransferFromAccount] = useState<string>('');
    const [transferToAccount, setTransferToAccount] = useState<string>('');
    const [isAddingTransferFromAccount, setIsAddingTransferFromAccount] = useState(false);
    const [isAddingTransferToAccount, setIsAddingTransferToAccount] = useState(false);
    const [newTransferFromAccountName, setNewTransferFromAccountName] = useState('');
    const [newTransferToAccountName, setNewTransferToAccountName] = useState('');
    const [newTransferFromAccountType, setNewTransferFromAccountType] = useState<AccountType>('checking');
    const [newTransferToAccountType, setNewTransferToAccountType] = useState<AccountType>('checking');
    const [creatingTransfer, setCreatingTransfer] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [originalTransactionType, setOriginalTransactionType] = useState<'transaction' | 'transfer' | null>(null);
    const [date, setDate] = useState<string>(() =>
        new Date().toISOString().slice(0, 10)
    );
    const [accountId, setAccountId] = useState<string>('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [categoryName, setCategoryName] = useState<string>('');
    const [isAddingFormCategory, setIsAddingFormCategory] = useState(false);
    const [amount, setAmount] = useState<string>('');
    const [note, setNote] = useState<string>('');
    /** When saving a transaction, also set category on every row with the same normalized description. */
    const [applyCategoryToMatchingDescriptions, setApplyCategoryToMatchingDescriptions] =
        useState(false);
    
    // Bulk transaction state
    const [bulkTransactions, setBulkTransactions] = useState<Array<{
        date: string;
        accountId: string;
        categoryId: string;
        categoryName: string;
        type: 'expense' | 'income';
        amount: string;
        note: string;
    }>>([{
        date: new Date().toISOString().slice(0, 10),
        accountId: '',
        categoryId: '',
        categoryName: '',
        type: 'expense',
        amount: '',
        note: '',
    }]);

    // month state
    const [monthDate, setMonthDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [transactionWindow, setTransactionWindow] = useState<'month' | 'all'>('month');

    // Bulk edit state
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [bulkEditCategory, setBulkEditCategory] = useState<string>('');
    const [bulkEditAccount, setBulkEditAccount] = useState<string>('');
    const [bulkEditDate, setBulkEditDate] = useState<string>('');
    const [bulkTransferFromAccount, setBulkTransferFromAccount] = useState<string>('');
    const [bulkTransferToAccount, setBulkTransferToAccount] = useState<string>('');
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const [categoryFilterId, setCategoryFilterId] = useState<string>('');
    const [sortMode, setSortMode] = useState<
        'date_desc' | 'merchant_frequency' | 'amount_desc' | 'amount_asc'
    >('date_desc');

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

    const visibleTransactions = useMemo(() => {
        if (!categoryFilterId) return transactions;
        if (categoryFilterId === '__uncategorized__') {
            return transactions.filter(tx => !tx.categoryId);
        }
        return transactions.filter(tx => tx.categoryId === categoryFilterId);
    }, [transactions, categoryFilterId]);

    const merchantFrequencyRows = useMemo(() => {
        const byMerchant = new Map<
            string,
            { key: string; label: string; count: number; totalAmount: number; latestDate: string }
        >();

        for (const tx of visibleTransactions) {
            const raw = (tx.name || tx.note || '').trim();
            const normalized = raw.toLowerCase().replace(/\s+/g, ' ');
            const key = normalized || '(no description)';
            const label = raw || '(No description)';
            const existing = byMerchant.get(key);
            if (existing) {
                existing.count += 1;
                existing.totalAmount += Math.abs(tx.amount);
                if (tx.date > existing.latestDate) existing.latestDate = tx.date;
            } else {
                byMerchant.set(key, {
                    key,
                    label,
                    count: 1,
                    totalAmount: Math.abs(tx.amount),
                    latestDate: tx.date,
                });
            }
        }

        return Array.from(byMerchant.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.totalAmount - a.totalAmount;
        });
    }, [visibleTransactions]);

    const displayedTransactions = useMemo(() => {
        if (sortMode === 'merchant_frequency') {
            const rankByMerchant = new Map<string, number>();
            merchantFrequencyRows.forEach((row, idx) => rankByMerchant.set(row.key, idx));
            return [...visibleTransactions].sort((a, b) => {
                const aKey = ((a.name || a.note || '').trim().toLowerCase().replace(/\s+/g, ' ')) || '(no description)';
                const bKey = ((b.name || b.note || '').trim().toLowerCase().replace(/\s+/g, ' ')) || '(no description)';
                const rankA = rankByMerchant.get(aKey) ?? Number.MAX_SAFE_INTEGER;
                const rankB = rankByMerchant.get(bKey) ?? Number.MAX_SAFE_INTEGER;
                if (rankA !== rankB) return rankA - rankB;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
        }
        if (sortMode === 'amount_desc') {
            return [...visibleTransactions].sort((a, b) => {
                const diff = Math.abs(b.amount) - Math.abs(a.amount);
                if (diff !== 0) return diff;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
        }
        if (sortMode === 'amount_asc') {
            return [...visibleTransactions].sort((a, b) => {
                const diff = Math.abs(a.amount) - Math.abs(b.amount);
                if (diff !== 0) return diff;
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });
        }
        return [...visibleTransactions].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [visibleTransactions, merchantFrequencyRows, sortMode]);

    const selectedBulkCategory = useMemo(
        () => categories.find(c => c.id === bulkEditCategory) || null,
        [categories, bulkEditCategory]
    );
    const transferCategoryId = useMemo(
        () =>
            categories.find(
                c =>
                    c.kind === 'category' &&
                    (c.type === 'transfer' || c.name.toLowerCase() === 'transfer')
            )?.id ?? null,
        [categories]
    );

    const bulkCategoryIsTransfer = Boolean(
        selectedBulkCategory &&
            (selectedBulkCategory.type === 'transfer' ||
                selectedBulkCategory.name.toLowerCase() === 'transfer')
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

    // 🔧 Helper: format error for logging and user display
    const formatError = (err: unknown): { message: string; debug: string } => {
        // Handle Supabase errors (PostgrestError)
        if (err && typeof err === 'object') {
            const errorObj = err as Record<string, any>;
            
            // Check for Supabase error structure
            if ('message' in errorObj || 'code' in errorObj || 'details' in errorObj) {
                const message = errorObj.message || 'Database error';
                const code = errorObj.code || '';
                const details = errorObj.details || '';
                const hint = errorObj.hint || '';
                
                // Build debug info with all available fields
                const debugParts: string[] = [];
                if (code) debugParts.push(`Code: ${code}`);
                if (message) debugParts.push(`Message: ${message}`);
                if (details) debugParts.push(`Details: ${details}`);
                if (hint) debugParts.push(`Hint: ${hint}`);
                
                // Include all enumerable and non-enumerable properties
                const allProps = Object.getOwnPropertyNames(errorObj);
                const extraProps = allProps.filter(p => !['message', 'code', 'details', 'hint'].includes(p));
                if (extraProps.length > 0) {
                    const extraPropsObj = extraProps.reduce((acc, key) => {
                        acc[key] = errorObj[key];
                        return acc;
                    }, {} as Record<string, any>);
                    debugParts.push(`Other props: ${JSON.stringify(extraPropsObj)}`);
                }
                
                // Generate user-friendly message based on error code
                let userMessage = message;
                if (code === '42501') {
                    // Check if it's an RLS violation
                    if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('rls')) {
                        userMessage = 'Permission denied: This action is not allowed by your account permissions. Please contact support if you believe this is an error.';
                    } else {
                        userMessage = 'Permission denied. You may not have access to perform this action.';
                    }
                } else if (code === '23502') {
                    userMessage = 'Validation failed: required field is missing.';
                } else if (code === '23505') {
                    userMessage = 'This record already exists.';
                } else if (code === '23503') {
                    userMessage = 'Invalid reference: related record not found.';
                } else if (code === '42P01') {
                    userMessage = 'Database table not found.';
                } else if (code && message) {
                    userMessage = `${message}${code ? ` (${code})` : ''}`;
                }
                
                return {
                    message: userMessage,
                    debug: debugParts.join(' | ') || JSON.stringify(errorObj, null, 2)
                };
            }
            
            // Handle standard Error objects
            if (err instanceof Error) {
                return {
                    message: err.message || 'An error occurred',
                    debug: `Error: ${err.name} | ${err.message}${err.stack ? `\nStack: ${err.stack}` : ''}`
                };
            }
            
            // Handle Response objects (fetch errors)
            if ('status' in errorObj && 'statusText' in errorObj) {
                const status = errorObj.status;
                const statusText = errorObj.statusText;
                return {
                    message: `Network error: ${status} ${statusText}`,
                    debug: `Response error: ${status} ${statusText} | ${JSON.stringify(errorObj, Object.getOwnPropertyNames(errorObj), 2)}`
                };
            }
            
            // Generic object - try to serialize with all properties
            try {
                const serialized = JSON.stringify(errorObj, Object.getOwnPropertyNames(errorObj), 2);
                return {
                    message: 'An unexpected error occurred',
                    debug: `Object error: ${serialized}`
                };
            } catch {
                return {
                    message: 'An error occurred (could not serialize)',
                    debug: `Non-serializable error: ${String(err)}`
                };
            }
        }
        
        // Handle primitives
        return {
            message: String(err) || 'An unknown error occurred',
            debug: `Primitive error: ${String(err)}`
        };
    };

    // Load accounts and categories
    useEffect(() => {
        const loadData = async () => {
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const [
                { data: accountsData, error: accountsError },
                { data: categoriesData, error: categoriesError },
            ] = await Promise.all([
                supabase.from('accounts').select('id, name').eq('user_id', user.id).order('name'),
                supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .eq('user_id', user.id)
                    .eq('is_archived', false)
                    .order('name'),
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

    useEffect(() => {
        if (!merchantKeyFromNameNote((note || '').trim() || null, null)) {
            setApplyCategoryToMatchingDescriptions(false);
        }
    }, [note]);

    // load transactions for selected window (month or all)
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

            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                setLoading(false);
                return;
            }

            const baseSelect = `
          id,
          date,
          amount,
          name,
          person,
          note,
          account_id,
          category_id,
          is_transfer,
          transfer_group_id,
          pending,
          accounts ( id, name ),
          categories ( id, name )
        `;

            let query = supabase
                .from('transactions')
                .select(baseSelect)
                .eq('user_id', user.id)
                .is('removed_at', null);

            if (transactionWindow === 'month') {
                query = query.gte('date', startStr).lt('date', endStr);
            }

            // Try to fetch with name field first (if migration has been run)
            let { data: txData, error: txError } = await query.order('date', { ascending: false });

            // If error and it might be due to missing 'name' column, retry without it
            if (txError && (txError.message?.includes('column') || txError.code === 'PGRST116')) {
                console.log('Retrying query without name column (migration may not be run yet)');
                let retryQuery = supabase
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
          pending,
          accounts ( id, name ),
          categories ( id, name )
        `)
                    .eq('user_id', user.id);

                if (transactionWindow === 'month') {
                    retryQuery = retryQuery.gte('date', startStr).lt('date', endStr);
                }

                const retryResult = await retryQuery.order('date', { ascending: false });
                
                // Add name: null to each row if it doesn't exist (migration not run yet)
                if (retryResult.data) {
                    txData = retryResult.data.map((row: any) => ({
                        ...row,
                        name: null,
                    }));
                }
                txError = retryResult.error;
            }

            // 🔍 Debug log so we SEE what's happening
            console.log('TX RAW RESULT (transactions page):', { txData, txError });

            if (txError) {
                console.error('Error loading transactions:', txError);
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
                name: tx.name ?? null, // Handle case where name column doesn't exist yet
                person: tx.person,
                note: tx.note,
                account: getRelName(tx.accounts),
                category: getRelName(tx.categories),
                accountId: tx.account_id,
                categoryId: tx.category_id,
                is_transfer: tx.is_transfer ?? false,
                transfer_group_id: tx.transfer_group_id,
                pending: tx.pending ?? false,
            }));

            setTransactions(mapped);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Transactions load failed', err);
            setNotification('Error loading transactions. Check console/logs.');
            setLoading(false);
        });
    }, [monthDate, transactionWindow]);

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
        setCategoryName('');
        setIsAddingFormCategory(false);
        setAmount('');
        setNote('');
        setEditingId(null);
        setOriginalTransactionType(null);
        setShowTransactionForm(false);
        setTransactionType('transaction');
        setExpenseIncomeType('expense');
        setTransferFromAccount('');
        setTransferToAccount('');
        setIsAddingTransferFromAccount(false);
        setIsAddingTransferToAccount(false);
        setNewTransferFromAccountName('');
        setNewTransferToAccountName('');
        setNewTransferFromAccountType('checking');
        setNewTransferToAccountType('checking');
        setApplyCategoryToMatchingDescriptions(false);
    };

    const inferPersonFromUser = (user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) => {
        const md = user.user_metadata || {};
        const fullName =
            (typeof md.full_name === 'string' && md.full_name.trim()) ||
            (typeof md.name === 'string' && md.name.trim()) ||
            (typeof md.display_name === 'string' && md.display_name.trim()) ||
            '';
        if (fullName) return fullName;
        const email = user.email || '';
        if (email.includes('@')) return email.split('@')[0];
        return 'User';
    };
    
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

        // Allow creating custom categories directly from the transaction form.
        if (type === 'income' || type === 'expense') {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                setNotification(`You must be logged in to create a new ${type} category.`);
                return null;
            }

            const { data, error } = await supabase
                .from('categories')
                .insert({
                    name: trimmedName,
                    type,
                    kind: 'category',
                    parent_id: null,
                    user_id: user.id,
                    is_archived: false,
                })
                .select('id, name, kind, parent_id, type')
                .single();

            if (error || !data?.id) {
                console.error(`Error creating ${type} category:`, error);
                setNotification(
                    error?.message
                        ? `Could not create category "${trimmedName}": ${error.message}`
                        : `Could not create category "${trimmedName}".`
                );
                return null;
            }

            setCategories(prev => [...prev, data as Category]);
            return data.id;
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

    const handleEditTransaction = (tx: Transaction) => {
        if (tx.is_transfer) {
            // For transfers, find both transactions in the group
            const transferGroup = transactions.filter(
                t => t.transfer_group_id === tx.transfer_group_id && t.is_transfer
            );
            const fromTx = transferGroup.find(t => t.amount < 0);
            const toTx = transferGroup.find(t => t.amount > 0);
            
            if (fromTx && toTx) {
                setEditingId(tx.id); // Store the ID of the transaction being edited
                setOriginalTransactionType('transfer'); // Track original type
                setTransactionType('transfer');
                setDate(tx.date.slice(0, 10));
                setAmount(Math.abs(fromTx.amount).toString()); // Use absolute value for amount input
                setNote(tx.name || tx.note || '');
                setTransferFromAccount(fromTx.accountId ?? '');
                setTransferToAccount(toTx.accountId ?? '');
                // Pre-fill regular transaction fields in case user switches to transaction type
                setAccountId(fromTx.accountId ?? '');
                setCategoryId(fromTx.categoryId ?? '');
                setIsAddingFormCategory(false);
                setShowTransactionForm(true);
            } else {
                setNotification('Could not find both sides of transfer. Please delete and recreate.');
            }
        } else {
            // Regular transaction
            setEditingId(tx.id);
            setOriginalTransactionType('transaction'); // Track original type
            setTransactionType('transaction');
            setExpenseIncomeType(tx.amount >= 0 ? 'income' : 'expense');
            setDate(tx.date.slice(0, 10));
            setAmount(Math.abs(tx.amount).toString());
            setNote(tx.name || tx.note || '');
            setAccountId(tx.accountId ?? '');
            setCategoryId(tx.categoryId ?? '');
            const cat = categories.find(c => c.id === tx.categoryId);
            setCategoryName(cat?.name || tx.category || '');
            setIsAddingFormCategory(false);
            // Pre-fill transfer fields in case user switches to transfer type
            setTransferFromAccount(tx.accountId ?? '');
            setTransferToAccount('');
            setShowTransactionForm(true);
        }
    };

    const handleCancelEdit = () => {
        resetFormToDefault();
    };

    const findOrCreateAccountByName = async (
        accountNameInput: string,
        accountType: AccountType,
        userId: string
    ): Promise<string | null> => {
        const trimmed = accountNameInput.trim();
        if (!trimmed) return null;

        const existing = accounts.find(a => a.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing.id;

        const { data, error } = await supabase
            .from('accounts')
            .insert({
                name: trimmed,
                type: accountType,
                starting_balance: 0,
                user_id: userId,
            })
            .select('id, name')
            .single();

        if (error || !data?.id) {
            console.error('Error creating account in transfer form:', error);
            setNotification(
                error?.message
                    ? `Could not create account "${trimmed}": ${error.message}`
                    : `Could not create account "${trimmed}".`
            );
            return null;
        }

        setAccounts(prev => [...prev, { id: data.id, name: data.name }]);
        return data.id;
    };

    const handleSaveTransaction = async (e: FormEvent, addAnother: boolean = false) => {
        e.preventDefault();

        const numAmount = Number(amount);
        if (!numAmount || !accountId) {
            setNotification('Please fill in all required fields.');
            return;
        }

        // Find or create category if categoryName is provided
        let finalCategoryId: string | null = categoryId || null;
        if (categoryName && !categoryId) {
            finalCategoryId = await findOrCreateCategory(categoryName, expenseIncomeType);
            if (!finalCategoryId) {
                setNotification('Please select or create a category.');
                return;
            }
        } else if (!categoryId) {
            setNotification('Please select or enter a category.');
            return;
        }
        
        if (!finalCategoryId) {
            setNotification('Please select or create a category.');
            return;
        }

        // Ensure amount has correct sign based on expense/income type
        let finalAmount = numAmount;
        if (transactionType === 'transaction') {
            if (expenseIncomeType === 'expense' && numAmount > 0) {
                finalAmount = -Math.abs(numAmount);
            } else if (expenseIncomeType === 'income' && numAmount < 0) {
                finalAmount = Math.abs(numAmount);
            }
        }

        setNotification(null);

        const sameDescriptionBulkSuffix = async (categoryIdForBulk: string): Promise<string> => {
            if (transactionType !== 'transaction' || !applyCategoryToMatchingDescriptions) {
                return '';
            }
            const anchorName = (note || '').trim() || null;
            const anchorNote: string | null = null;
            if (!merchantKeyFromNameNote(anchorName, anchorNote)) {
                return ' Same-description bulk apply skipped (add a transaction name).';
            }
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) {
                return ' Same-description bulk apply skipped (not signed in).';
            }
            try {
                const res = await fetch('/api/finance/apply-category-to-matching', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        category_id: categoryIdForBulk,
                        name: anchorName,
                        note: anchorNote,
                    }),
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok) {
                    return ` Same-description bulk apply failed: ${payload.error || res.statusText}.`;
                }
                const updated = Number(payload.updated) || 0;
                const matched = Number(payload.matched) || 0;
                if (updated > 0) {
                    return ` Also updated ${updated} other transaction${updated === 1 ? '' : 's'} with the same description (${matched} matched in total).`;
                }
                if (matched > 1) {
                    return ` ${matched} transactions share this description; others were already in this category.`;
                }
                return '';
            } catch {
                return ' Same-description bulk apply failed (network).';
            }
        };

        if (editingId) {
            // Check if transaction type has changed
            const typeChanged = originalTransactionType !== 'transaction';
            
            if (typeChanged) {
                // Converting from transfer to transaction - delete old transfer, create new transaction
                const editingTx = transactions.find(t => t.id === editingId);
                if (!editingTx) {
                    setNotification('Transaction not found.');
                    return;
                }

                // Delete the transfer group if it exists
                if (editingTx.transfer_group_id) {
                    const transferGroup = transactions.filter(
                        t => t.transfer_group_id === editingTx.transfer_group_id && t.is_transfer
                    );
                    
                    if (transferGroup.length > 0) {
                        const { error: deleteError } = await supabase
                            .from('transactions')
                            .delete()
                            .in('id', transferGroup.map(t => t.id));

                        if (deleteError) {
                            const { message, debug } = formatError(deleteError);
                            console.error('Error deleting old transfer:', debug);
                            setNotification(`Error converting transfer: ${message}`);
                            return;
                        }
                    }
                }

                // Get authenticated user
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    setNotification('Authentication error. Please log in again.');
                    return;
                }

                // Create new regular transaction
                const inferredPerson = inferPersonFromUser(user);
                const { error: insertError } = await supabase.from('transactions').insert({
                    date,
                    account_id: accountId,
                    category_id: finalCategoryId,
                    amount: finalAmount,
                    name: note || null, // Use note as name for manual transactions
                    person: inferredPerson,
                    note: null, // Clear note since we're using name
                    is_transfer: false,
                    transfer_group_id: null,
                    user_id: user.id,
                });

                if (insertError) {
                    const { message, debug } = formatError(insertError);
                    console.error('Error creating transaction:', debug);
                    setNotification(`Error converting transfer: ${message}`);
                    return;
                }

                if (finalCategoryId) {
                    void learnMerchantMappingFromUserCategory(supabase, {
                        userId: user.id,
                        categoryId: finalCategoryId,
                        name: (note || '').trim() || editingTx.name || null,
                        note: editingTx.note || null,
                    });
                }

                const extra = finalCategoryId
                    ? await sameDescriptionBulkSuffix(finalCategoryId)
                    : '';
                setNotification('Transfer converted to transaction.' + extra);
            } else {
                // UPDATE existing transaction (same type)
                if (!finalCategoryId) {
                    setNotification('Please select or create a category.');
                    return;
                }
                const { data: { user: updateUser }, error: updateUserError } = await supabase.auth.getUser();
                if (updateUserError || !updateUser) {
                    setNotification('Authentication error. Please log in again.');
                    return;
                }
                const inferredPerson = inferPersonFromUser(updateUser);
                const { error } = await supabase
                    .from('transactions')
                    .update({
                        date,
                        account_id: accountId,
                        category_id: finalCategoryId,
                        amount: finalAmount,
                        name: note || null, // Use note as name for manual transactions
                        person: inferredPerson,
                        note: null, // Clear note since we're using name
                    })
                    .eq('id', editingId);

                if (error) {
                    const { message, debug } = formatError(error);
                    console.error('Error updating transaction:', debug);
                    setNotification(`Error updating transaction: ${message}`);
                    return;
                }

                const priorTx = transactions.find(t => t.id === editingId);
                if (transactionType === 'transaction' && finalCategoryId && priorTx) {
                    const { data: { user: u2 } } = await supabase.auth.getUser();
                    if (u2) {
                        void learnMerchantMappingFromUserCategory(supabase, {
                            userId: u2.id,
                            categoryId: finalCategoryId,
                            name: (note || '').trim() || priorTx.name || null,
                            note: priorTx.note || null,
                        });
                    }
                }

                const extra = finalCategoryId
                    ? await sameDescriptionBulkSuffix(finalCategoryId)
                    : '';
                setNotification('Transaction updated.' + extra);
            }
        } else {
            // INSERT new transaction
            if (!finalCategoryId) {
                setNotification('Please select or create a category.');
                return;
            }

            // Get authenticated user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                setNotification('Authentication error. Please log in again.');
                return;
            }

            const inferredPerson = inferPersonFromUser(user);
            const { error } = await supabase.from('transactions').insert({
                date,
                account_id: accountId,
                category_id: finalCategoryId,
                amount: finalAmount,
                name: note || null, // Use note as name for manual transactions
                person: inferredPerson,
                note: null, // Clear note since we're using name
                is_transfer: false,
                transfer_group_id: null,
                user_id: user.id,
            });

            if (error) {
                const { message, debug } = formatError(error);
                console.error('Error saving transaction:', debug);
                setNotification(`Error saving transaction: ${message}`);
                return;
            }

            void learnMerchantMappingFromUserCategory(supabase, {
                userId: user.id,
                categoryId: finalCategoryId,
                name: (note || '').trim() || null,
                note: null,
            });

            const extra = await sameDescriptionBulkSuffix(finalCategoryId);
            setNotification('Transaction saved.' + extra);
        }

        if (!editingId && addAnother) {
            // Keep form open and reset fields but keep account and date
            setCategoryId('');
            setCategoryName('');
            setAmount('');
            setNote('');
            setExpenseIncomeType('expense');
            // Keep accountId and date for quick entry
        } else {
            resetFormToDefault();
            setShowTransactionForm(false);
        }
        // Reload transactions
        setMonthDate(prev => new Date(prev));
    };
    
    const handleBulkSave = async () => {
        const validTransactions = bulkTransactions.filter(tx => 
            tx.date && tx.accountId && tx.amount && (tx.categoryId || tx.categoryName)
        );
        
        if (validTransactions.length === 0) {
            setNotification('Please add at least one valid transaction.');
            return;
        }
        
        setNotification(null);
        
        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            setNotification('Authentication error. Please log in again.');
            return;
        }
        
        // Process each transaction, creating categories as needed
        const inferredPerson = inferPersonFromUser(user);
        const transactionsToInsert = [];
        for (const tx of validTransactions) {
            // Find or create category
            let finalCategoryId: string | null = tx.categoryId || null;
            if (tx.categoryName && !tx.categoryId) {
                finalCategoryId = await findOrCreateCategory(tx.categoryName, tx.type);
                if (!finalCategoryId) {
                    setNotification(`Error creating category "${tx.categoryName}". Skipping transaction.`);
                    continue;
                }
            } else if (!tx.categoryId) {
                setNotification(`Missing category for transaction. Skipping.`);
                continue;
            }
            
            if (!finalCategoryId) {
                setNotification(`Missing category for transaction. Skipping.`);
                continue;
            }
            
            let finalAmount = Number(tx.amount);
            if (tx.type === 'expense' && finalAmount > 0) {
                finalAmount = -Math.abs(finalAmount);
            } else if (tx.type === 'income' && finalAmount < 0) {
                finalAmount = Math.abs(finalAmount);
            }
            
            transactionsToInsert.push({
                date: tx.date,
                account_id: tx.accountId,
                category_id: finalCategoryId,
                amount: finalAmount,
                person: inferredPerson,
                name: tx.note || null,
                note: null,
                is_transfer: false,
                transfer_group_id: null,
                user_id: user.id,
            });
        }
        
        if (transactionsToInsert.length === 0) {
            setNotification('No valid transactions to save.');
            return;
        }
        
        const { error } = await supabase
            .from('transactions')
            .insert(transactionsToInsert);
        
        if (error) {
            console.error(error);
            setNotification('Error saving bulk transactions. Check console/logs.');
            return;
        }
        
        setNotification(`Successfully saved ${transactionsToInsert.length} transaction(s).`);
        setBulkTransactions([{
            date: new Date().toISOString().slice(0, 10),
            accountId: '',
            categoryId: '',
            categoryName: '',
            type: 'expense',
            amount: '',
            note: '',
        }]);
        setShowBulkTransaction(false);
        // Reload transactions
        setMonthDate(prev => new Date(prev));
    };

    const handleDeleteTransaction = async (id: string) => {
        setNotification(null);

        const tx = transactions.find(t => t.id === id);
        if (!tx) {
            setNotification('Transaction not found.');
            return;
        }

        if (typeof window !== 'undefined') {
            const message = tx.is_transfer
                ? 'Delete this transfer? This will delete both transactions in the transfer.'
                : 'Delete this transaction?';
            const ok = window.confirm(message);
            if (!ok) return;
        }

        // If it's a transfer, delete both transactions in the group
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

                setNotification('Transfer deleted.');
                // Remove all IDs from selection
                setSelectedTransactionIds(prev => {
                    const next = new Set(prev);
                    transferGroup.forEach(t => next.delete(t.id));
                    return next;
                });
                // Reload transactions
                setMonthDate(prev => new Date(prev));
                return;
            }
        }

        // Regular transaction deletion
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
        setSelectedTransactionIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        // Reload transactions
        setMonthDate(prev => new Date(prev));
    };

    // =========================================================
    // 🆕 BULK EDIT FUNCTIONS
    // =========================================================

    const handleToggleSelectTransaction = (id: string) => {
        setSelectedTransactionIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        const visibleIds = visibleTransactions.map(tx => tx.id);
        const allVisibleSelected =
            visibleIds.length > 0 && visibleIds.every(id => selectedTransactionIds.has(id));

        setSelectedTransactionIds(prev => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                visibleIds.forEach(id => next.delete(id));
            } else {
                visibleIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleBulkUpdate = async () => {
        if (selectedTransactionIds.size === 0) {
            setNotification('Please select at least one transaction to update.');
            return;
        }

        setBulkUpdating(true);
        setNotification(null);

        try {
            const { data: { user: bulkUser } } = await supabase.auth.getUser();
            if (!bulkUser) {
                setNotification('You must be logged in to bulk edit transactions.');
                setBulkUpdating(false);
                return;
            }
            const inferredPerson = inferPersonFromUser(bulkUser);

            const ids = Array.from(selectedTransactionIds);

            if (bulkCategoryIsTransfer) {
                if (!bulkTransferFromAccount || !bulkTransferToAccount) {
                    setNotification('For transfer bulk edit, select both From and To accounts.');
                    setBulkUpdating(false);
                    return;
                }
                if (bulkTransferFromAccount === bulkTransferToAccount) {
                    setNotification('From and To accounts must be different for transfers.');
                    setBulkUpdating(false);
                    return;
                }

                const selectedTxs = transactions.filter(tx => selectedTransactionIds.has(tx.id));
                const inserts: Array<{
                    date: string;
                    account_id: string;
                    category_id: string;
                    amount: number;
                    person: string;
                    note: string | null;
                    name: string | null;
                    user_id: string;
                    is_transfer: boolean;
                    transfer_group_id: string;
                }> = [];

                for (const tx of selectedTxs) {
                    const transferGroupId = crypto.randomUUID();
                    const transferAmount = Math.abs(Number(tx.amount || 0));
                    const transferDate = bulkEditDate || tx.date;
                    const transferLabel = tx.name || tx.note || 'Transfer';

                    const { error: fromError } = await supabase
                        .from('transactions')
                        .update({
                            date: transferDate,
                            account_id: bulkTransferFromAccount,
                            category_id: bulkEditCategory,
                            amount: -transferAmount,
                            is_transfer: true,
                            transfer_group_id: transferGroupId,
                            name: transferLabel,
                            note: tx.note || transferLabel,
                        })
                        .eq('id', tx.id);

                    if (fromError) {
                        console.error('Bulk transfer update (from side) error:', fromError);
                        setNotification(`Error converting transaction to transfer: ${fromError.message}`);
                        setBulkUpdating(false);
                        return;
                    }

                    inserts.push({
                        date: transferDate,
                        account_id: bulkTransferToAccount,
                        category_id: bulkEditCategory,
                        amount: transferAmount,
                        person: inferredPerson,
                        note: tx.note || transferLabel,
                        name: transferLabel,
                        user_id: bulkUser.id,
                        is_transfer: true,
                        transfer_group_id: transferGroupId,
                    });
                }

                if (inserts.length > 0) {
                    const { error: insertError } = await supabase
                        .from('transactions')
                        .insert(inserts);
                    if (insertError) {
                        console.error('Bulk transfer insert (to side) error:', insertError);
                        setNotification(`Error creating transfer counterparts: ${insertError.message}`);
                        setBulkUpdating(false);
                        return;
                    }
                }

                if (transferCategoryId) {
                    for (const tx of selectedTxs) {
                        void learnMerchantMappingFromUserCategory(supabase, {
                            userId: bulkUser.id,
                            categoryId: transferCategoryId,
                            name: tx.name || tx.note || null,
                            note: tx.note || null,
                        });
                    }
                }

                setNotification(
                    `Successfully converted ${ids.length} transaction${ids.length !== 1 ? 's' : ''} into transfer${ids.length !== 1 ? 's' : ''}.`
                );
                setSelectedTransactionIds(new Set());
                setShowBulkEdit(false);
                setBulkEditCategory('');
                setBulkEditAccount('');
                setBulkEditDate('');
                setBulkTransferFromAccount('');
                setBulkTransferToAccount('');
                setMonthDate(prev => new Date(prev));
                return;
            }

            const updates: any = {};
            let hasUpdates = false;

            if (bulkEditCategory) {
                updates.category_id = bulkEditCategory;
                hasUpdates = true;
            }
            if (bulkEditAccount) {
                updates.account_id = bulkEditAccount;
                hasUpdates = true;
            }
            if (bulkEditDate) {
                updates.date = bulkEditDate;
                hasUpdates = true;
            }

            if (!hasUpdates) {
                setNotification('Please select at least one field to update.');
                setBulkUpdating(false);
                return;
            }

            const { error } = await supabase
                .from('transactions')
                .update(updates)
                .in('id', ids);

            if (error) {
                console.error('Bulk update error:', error);
                setNotification(`Error updating transactions: ${error.message}`);
                setBulkUpdating(false);
                return;
            }

            if (bulkEditCategory) {
                if (bulkUser) {
                    for (const id of ids) {
                        const tx = transactions.find(t => t.id === id);
                        if (!tx) continue;
                        void learnMerchantMappingFromUserCategory(supabase, {
                            userId: bulkUser.id,
                            categoryId: bulkEditCategory,
                            name: tx.name,
                            note: tx.note,
                        });
                    }
                }
            }

            setNotification(`Successfully updated ${ids.length} transaction${ids.length !== 1 ? 's' : ''}.`);
            setSelectedTransactionIds(new Set());
            setShowBulkEdit(false);
            setBulkEditCategory('');
            setBulkEditAccount('');
            setBulkEditDate('');
            setBulkTransferFromAccount('');
            setBulkTransferToAccount('');
            setMonthDate(prev => new Date(prev));
        } catch (err) {
            console.error('Bulk update failed:', err);
            setNotification('Error updating transactions. Check console/logs.');
        } finally {
            setBulkUpdating(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedTransactionIds.size === 0) {
            setNotification('Please select at least one transaction to delete.');
            return;
        }

        // Collect all transaction IDs to delete, including transfer groups
        const idsToDelete = new Set<string>(Array.from(selectedTransactionIds));
        
        // For any selected transfers, add their paired transaction to the delete set
        const selectedTransactions = transactions.filter(tx => selectedTransactionIds.has(tx.id));
        const transferGroupIds = new Set<string>();
        
        selectedTransactions.forEach(tx => {
            if (tx.is_transfer && tx.transfer_group_id) {
                transferGroupIds.add(tx.transfer_group_id);
            }
        });

        // For each transfer group, find all transactions in the group and add them to delete set
        transferGroupIds.forEach(groupId => {
            const groupTransactions = transactions.filter(
                t => t.transfer_group_id === groupId && t.is_transfer
            );
            groupTransactions.forEach(t => idsToDelete.add(t.id));
        });

        const totalToDelete = idsToDelete.size;
        const transferCount = Array.from(transferGroupIds).length;

        if (typeof window !== 'undefined') {
            let confirmMessage = `Delete ${totalToDelete} selected transaction${totalToDelete !== 1 ? 's' : ''}?`;
            if (transferCount > 0) {
                confirmMessage += ` This includes ${transferCount} transfer${transferCount !== 1 ? 's' : ''} (${totalToDelete} total transaction${totalToDelete !== 1 ? 's' : ''}).`;
            }
            const ok = window.confirm(confirmMessage);
            if (!ok) return;
        }

        setBulkUpdating(true);
        setNotification(null);

        try {
            const idsArray = Array.from(idsToDelete);
            const { error } = await supabase
                .from('transactions')
                .delete()
                .in('id', idsArray);

            if (error) {
                console.error('Bulk delete error:', error);
                setNotification(`Error deleting transactions: ${error.message}`);
                setBulkUpdating(false);
                return;
            }

            setNotification(`Successfully deleted ${totalToDelete} transaction${totalToDelete !== 1 ? 's' : ''}.`);
            setSelectedTransactionIds(new Set());
            setShowBulkEdit(false);
            setMonthDate(prev => new Date(prev));
        } catch (err) {
            console.error('Bulk delete failed:', err);
            setNotification('Error deleting transactions. Check console/logs.');
        } finally {
            setBulkUpdating(false);
        }
    };

    // =========================================================
    // 🆕 TRANSFER CREATION LOGIC
    // =========================================================

    const handleCreateTransfer = async (e: FormEvent) => {
        e.preventDefault();

        if (!transferFromAccount || !transferToAccount || !amount) {
            setNotification('Please fill in all required fields.');
            return;
        }

        const numAmount = parseFloat(amount);
        if (Number.isNaN(numAmount) || numAmount <= 0) {
            setNotification('Amount must be a positive number.');
            return;
        }

        setCreatingTransfer(true);
        setNotification(null);

        try {
            // Get authenticated user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                setNotification('Authentication error. Please log in again.');
                return;
            }

            let resolvedFromAccountId = transferFromAccount;
            let resolvedToAccountId = transferToAccount;

            if (transferFromAccount === '__add_new__') {
                resolvedFromAccountId = (await findOrCreateAccountByName(
                    newTransferFromAccountName,
                    newTransferFromAccountType,
                    user.id
                )) || '';
                if (!resolvedFromAccountId) {
                    if (!newTransferFromAccountName.trim()) {
                        setNotification('Please enter a valid new "From Account" name.');
                    }
                    return;
                }
            }
            if (transferToAccount === '__add_new__') {
                resolvedToAccountId = (await findOrCreateAccountByName(
                    newTransferToAccountName,
                    newTransferToAccountType,
                    user.id
                )) || '';
                if (!resolvedToAccountId) {
                    if (!newTransferToAccountName.trim()) {
                        setNotification('Please enter a valid new "To Account" name.');
                    }
                    return;
                }
            }

            if (!resolvedFromAccountId || !resolvedToAccountId) {
                setNotification('Please fill in both transfer accounts.');
                return;
            }
            if (resolvedFromAccountId === resolvedToAccountId) {
                setNotification('From and To accounts must be different.');
                return;
            }

            // Resolve account names (including freshly created inline accounts).
            const fromAccountName =
                transferFromAccount === '__add_new__'
                    ? newTransferFromAccountName.trim()
                    : accounts.find(a => a.id === resolvedFromAccountId)?.name || 'Unknown';
            const toAccountName =
                transferToAccount === '__add_new__'
                    ? newTransferToAccountName.trim()
                    : accounts.find(a => a.id === resolvedToAccountId)?.name || 'Unknown';
            const transferLabel = `Transfer: ${fromAccountName || 'Unknown'} → ${toAccountName || 'Unknown'}`;

            if (editingId) {
                const editingTx = transactions.find(t => t.id === editingId);
                if (!editingTx) {
                    setNotification('Transaction not found.');
                    return;
                }

                // Check if we're converting from a regular transaction to a transfer
                const typeChanged = originalTransactionType !== 'transfer';
                
                if (typeChanged) {
                    // Converting from transaction to transfer - delete old transaction, create new transfer
                    const { error: deleteError } = await supabase
                        .from('transactions')
                        .delete()
                        .eq('id', editingId);

                    if (deleteError) {
                        console.error('Error deleting old transaction:', deleteError);
                        setNotification('Error converting transaction. Check console/logs.');
                        return;
                    }

                    // Create new transfer transactions
                    const transferGroupId = crypto.randomUUID();
                    const { error: insertError } = await supabase.from('transactions').insert([
                        {
                            date,
                            amount: -numAmount, // Negative: money leaving source account
                            person: transferLabel,
                            note: note || null,
                            account_id: resolvedFromAccountId,
                            category_id: transferCategoryId,
                            is_transfer: true,
                            transfer_group_id: transferGroupId,
                            user_id: user.id,
                        },
                        {
                            date,
                            amount: numAmount, // Positive: money entering destination account
                            person: transferLabel,
                            note: note || null,
                            account_id: resolvedToAccountId,
                            category_id: transferCategoryId,
                            is_transfer: true,
                            transfer_group_id: transferGroupId,
                            user_id: user.id,
                        },
                    ]);

                    if (insertError) {
                        console.error('Error creating transfer:', insertError);
                        setNotification('Error converting transaction. Check console/logs.');
                        return;
                    }

                // Learn from user conversion so similar descriptions map to Transfer next time.
                if (transferCategoryId) {
                    void learnMerchantMappingFromUserCategory(supabase, {
                        userId: user.id,
                        categoryId: transferCategoryId,
                        name: editingTx.name || note || null,
                        note: editingTx.note || note || null,
                    });
                }

                    setNotification(
                        `Transaction converted to transfer: ${fromAccountName} → ${toAccountName} (${new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(numAmount)})`
                    );
                } else {
                    // UPDATE existing transfer - find both transactions in the group
                    if (!editingTx.transfer_group_id) {
                        setNotification('Could not find transfer to update.');
                        return;
                    }

                    // Find both transactions in the transfer group
                    const transferGroup = transactions.filter(
                        t => t.transfer_group_id === editingTx.transfer_group_id && t.is_transfer
                    );
                    
                    if (transferGroup.length !== 2) {
                        setNotification('Transfer group is incomplete. Please delete and recreate.');
                        return;
                    }

                    // Delete old transactions and create new ones (simpler than updating individual fields)
                    const { error: deleteError } = await supabase
                        .from('transactions')
                        .delete()
                        .in('id', transferGroup.map(t => t.id));

                    if (deleteError) {
                        console.error('Error deleting old transfer:', deleteError);
                        setNotification('Error updating transfer. Check console/logs.');
                        return;
                    }

                    // Create updated transfer transactions with same group ID
                    const { error: insertError } = await supabase.from('transactions').insert([
                        {
                            date,
                            amount: -numAmount, // Negative: money leaving source account
                            person: transferLabel,
                            note: note || null,
                            account_id: resolvedFromAccountId,
                            category_id: transferCategoryId,
                            is_transfer: true,
                            transfer_group_id: editingTx.transfer_group_id, // Keep same group ID
                            user_id: user.id,
                        },
                        {
                            date,
                            amount: numAmount, // Positive: money entering destination account
                            person: transferLabel,
                            note: note || null,
                            account_id: resolvedToAccountId,
                            category_id: transferCategoryId,
                            is_transfer: true,
                            transfer_group_id: editingTx.transfer_group_id, // Keep same group ID
                            user_id: user.id,
                        },
                    ]);

                    if (insertError) {
                        console.error('Transfer update error:', insertError);
                        setNotification('Error updating transfer. Check console/logs.');
                        return;
                    }

                    if (transferCategoryId) {
                        void learnMerchantMappingFromUserCategory(supabase, {
                            userId: user.id,
                            categoryId: transferCategoryId,
                            name: editingTx.name || note || null,
                            note: editingTx.note || note || null,
                        });
                    }

                    setNotification(
                        `Transfer updated: ${fromAccountName} → ${toAccountName} (${new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(numAmount)})`
                    );
                }
            } else {
                // CREATE new transfer
                // Generate a new UUID for the transfer group
                const transferGroupId = crypto.randomUUID();

                // Create two linked transactions
                const { error } = await supabase.from('transactions').insert([
                    {
                        date,
                        amount: -numAmount, // Negative: money leaving source account
                        person: transferLabel,
                        note: note || null,
                        account_id: resolvedFromAccountId,
                        category_id: transferCategoryId,
                        is_transfer: true,
                        transfer_group_id: transferGroupId,
                        user_id: user.id,
                    },
                    {
                        date,
                        amount: numAmount, // Positive: money entering destination account
                        person: transferLabel,
                        note: note || null,
                        account_id: resolvedToAccountId,
                        category_id: transferCategoryId,
                        is_transfer: true,
                        transfer_group_id: transferGroupId,
                        user_id: user.id,
                    },
                ]);

                if (error) {
                    console.error('Transfer creation error:', error);
                    setNotification('Error creating transfer. Check console/logs.');
                    return;
                }

                if (transferCategoryId) {
                    void learnMerchantMappingFromUserCategory(supabase, {
                        userId: user.id,
                        categoryId: transferCategoryId,
                        name: note || null,
                        note: note || null,
                    });
                }

                setNotification(
                `Transfer created: ${fromAccountName} → ${toAccountName} (${new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                    }).format(numAmount)})`
                );
            }

            // Reset form
            resetFormToDefault();

            // Reload transactions
            setMonthDate(prev => new Date(prev)); // clone to force useEffect rerun
        } catch (err) {
            console.error('Transfer operation failed:', err);
            setNotification('Error processing transfer. Check console/logs.');
        } finally {
            setCreatingTransfer(false);
        }
    };

    // =========================================================
    // 🆕 IMPORT PREVIEW & COMMIT LOGIC
    // =========================================================

    const handleCommitImport = async () => {
        if (!importAccountId) {
            setNotification('Please select an account before importing.');
            return;
        }

        const selectedTransactions = pendingImportTransactions.filter(tx => tx.selected);
        if (selectedTransactions.length === 0) {
            setNotification('Please select at least one transaction to import.');
            return;
        }

        setImporting(true);
        setNotification(null);

        try {
            // Separate regular transactions from transfers
            const regularTransactions = selectedTransactions.filter(tx => !tx.isTransfer || !tx.transferToAccountId);
            const transfers = selectedTransactions.filter(tx => tx.isTransfer && tx.transferToAccountId);

            // Commit regular transactions
            if (regularTransactions.length > 0) {
                // Process transactions, creating categories as needed
                const processedTransactions = [];
                for (const tx of regularTransactions) {
                    let finalCategoryId = tx.categoryId;
                    
                    // If we have a categoryName but no categoryId, try to find or create it
                    if (tx.categoryName && !tx.categoryId) {
                        // Determine transaction type from amount
                        const txType = tx.amount < 0 ? 'expense' : 'income';
                        finalCategoryId = await findOrCreateCategory(tx.categoryName, txType);
                        if (!finalCategoryId) {
                            setNotification(`Error creating category "${tx.categoryName}". Skipping transaction.`);
                            continue;
                        }
                    }
                    
                    processedTransactions.push({
                        date: tx.date,
                        description: tx.description, // This will become the 'name' field
                        amount: tx.amount,
                        categoryId: finalCategoryId || null,
                    });
                }
                
                if (processedTransactions.length === 0) {
                    setNotification('No valid transactions to import.');
                    return;
                }
                
                const response = await fetch('/api/import/commit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        accountId: importAccountId,
                        transactions: processedTransactions,
                    }),
                });

                const result = await response.json();

                if (!response.ok) {
                    setNotification(result.error || 'Error committing transactions.');
                    return;
                }
            }

            // Handle transfers separately
            if (transfers.length > 0) {
                for (const transfer of transfers) {
                    // Create transfer using the same logic as manual transfers
                    const transferGroupId = crypto.randomUUID();
                    const fromAccountName = accounts.find(a => a.id === importAccountId)?.name || 'Unknown';
                    const toAccountName = accounts.find(a => a.id === transfer.transferToAccountId)?.name || 'Unknown';
                    
                    const { error: transferError } = await supabase
                        .from('transactions')
                        .insert([
                            {
                                date: transfer.date,
                                amount: -Math.abs(transfer.amount),
                                person: `Transfer: ${fromAccountName} → ${toAccountName}`,
                                note: transfer.description || null,
                                account_id: importAccountId,
                                category_id: transferCategoryId,
                                is_transfer: true,
                                transfer_group_id: transferGroupId,
                            },
                            {
                                date: transfer.date,
                                amount: Math.abs(transfer.amount),
                                person: `Transfer: ${fromAccountName} → ${toAccountName}`,
                                note: transfer.description || null,
                                account_id: transfer.transferToAccountId,
                                category_id: transferCategoryId,
                                is_transfer: true,
                                transfer_group_id: transferGroupId,
                            },
                        ]);

                    if (transferError) {
                        console.error('Transfer creation error:', transferError);
                        setNotification(`Error creating transfer: ${transferError.message}`);
                        return;
                    }
                }
            }

            const totalImported = regularTransactions.length + transfers.length;
            setNotification(
                `Successfully imported ${totalImported} transaction${totalImported !== 1 ? 's' : ''}${transfers.length > 0 ? ` (${transfers.length} transfer${transfers.length !== 1 ? 's' : ''})` : ''}.`
            );

            // Clear preview
            setPendingImportTransactions([]);
            setImportAccountId('');

            const { data: sessionWrap } = await supabase.auth.getSession();
            const accessToken = sessionWrap?.session?.access_token;
            if (accessToken) {
                try {
                    await fetch('/api/finance/link-internal-transfers', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: '{}',
                    });
                } catch {
                    /* linker is best-effort */
                }
            }

            // Reload transactions
            setMonthDate(prev => new Date(prev));
        } catch (err) {
            console.error('Commit import failed:', err);
            setNotification('Error committing transactions. Check console/logs.');
        } finally {
            setImporting(false);
        }
    };

    const handleCancelImport = () => {
        setPendingImportTransactions([]);
        setImportAccountId('');
        setNotification(null);
    };

    const handleToggleSelectAllImport = () => {
        const allSelected = pendingImportTransactions.every(tx => tx.selected);
        setPendingImportTransactions(prev =>
            prev.map(tx => ({ ...tx, selected: !allSelected }))
        );
    };

    const handleToggleSelect = (index: number) => {
        setPendingImportTransactions(prev =>
            prev.map((tx, i) => (i === index ? { ...tx, selected: !tx.selected } : tx))
        );
    };

    const handleRemoveSelected = () => {
        setPendingImportTransactions(prev => prev.filter(tx => !tx.selected));
    };

    const handleBulkCategoryApply = (categoryId: string | null) => {
        setPendingImportTransactions(prev =>
            prev.map(tx => (tx.selected ? { ...tx, categoryId } : tx))
        );
    };

    const handleUpdatePendingTransaction = (
        index: number,
        field: keyof PendingTransaction,
        value: any
    ) => {
        setPendingImportTransactions(prev =>
            prev.map((tx, i) => {
                if (i === index) {
                    const updated = { ...tx, [field]: value };
                    // If updating categoryId to null and we have categoryName, keep the name
                    if (field === 'categoryId' && value === null && updated.categoryName) {
                        // Keep categoryName for later creation
                    }
                    return updated;
                }
                return tx;
            })
        );
    };

    // AI Category Suggestion
    const checkDuplicatesAndAutoCategorize = async (transactions: PendingTransaction[]) => {
        if (!importAccountId || transactions.length === 0) {
            setPendingImportTransactions(transactions);
            setNotification(
                `Parsed ${transactions.length} transactions. Review and confirm below.`
            );
            return;
        }

        try {
            setNotification('Checking for duplicates and auto-categorizing...');
            
            const response = await fetch('/api/transactions/check-duplicates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transactions: transactions.map(tx => ({
                        date: tx.date,
                        description: tx.description,
                        amount: tx.amount,
                    })),
                    accountId: importAccountId,
                }),
            });

            if (!response.ok) {
                console.error('Duplicate check failed');
                setPendingImportTransactions(transactions);
                setNotification(
                    `Parsed ${transactions.length} transactions. Review and confirm below.`
                );
                return;
            }

            const result = await response.json();
            const duplicateResults = result.results || [];

            // Update transactions with duplicate info and auto-categorization
            const updatedTransactions = transactions.map((tx, index) => {
                const duplicateInfo = duplicateResults[index];
                if (!duplicateInfo) return tx;

                const updated: PendingTransaction = {
                    ...tx,
                    isDuplicate: duplicateInfo.isDuplicate,
                    existingTransactionId: duplicateInfo.existingTransactionId,
                    duplicateChecked: true,
                };

                // Auto-apply category from duplicate or suggestion
                if (duplicateInfo.isDuplicate && duplicateInfo.existingCategoryId) {
                    // Use category from duplicate
                    updated.categoryId = duplicateInfo.existingCategoryId;
                    updated.suggestedCategoryId = duplicateInfo.existingCategoryId;
                    updated.suggestedCategoryName = duplicateInfo.suggestedCategoryName;
                    updated.suggestionConfidence = 1.0;
                    updated.suggestionReasoning = 'Category from existing duplicate transaction';
                } else if (duplicateInfo.suggestedCategoryId && !tx.categoryId) {
                    // Use suggested category from pattern matching
                    updated.categoryId = duplicateInfo.suggestedCategoryId;
                    updated.suggestedCategoryId = duplicateInfo.suggestedCategoryId;
                    updated.suggestedCategoryName = duplicateInfo.suggestedCategoryName;
                    updated.suggestionConfidence = 0.8;
                    updated.suggestionReasoning = 'Category suggested based on similar existing transactions';
                }

                // Auto-deselect duplicates
                if (duplicateInfo.isDuplicate) {
                    updated.selected = false;
                }

                return updated;
            });

            const duplicateCount = updatedTransactions.filter(tx => tx.isDuplicate).length;
            const autoCategorizedCount = updatedTransactions.filter(
                tx => tx.categoryId && !tx.isDuplicate
            ).length;

            setPendingImportTransactions(updatedTransactions);
            
            let notificationMsg = `Parsed ${transactions.length} transactions.`;
            if (duplicateCount > 0) {
                notificationMsg += ` Found ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} (deselected).`;
            }
            if (autoCategorizedCount > 0) {
                notificationMsg += ` Auto-categorized ${autoCategorizedCount} transaction${autoCategorizedCount !== 1 ? 's' : ''} based on existing patterns.`;
            }
            notificationMsg += ' Review and confirm below.';
            
            setNotification(notificationMsg);
        } catch (error) {
            console.error('Error checking duplicates:', error);
            setPendingImportTransactions(transactions);
            setNotification(
                `Parsed ${transactions.length} transactions. Review and confirm below.`
            );
        }
    };

    const handleSuggestCategories = async () => {
        if (pendingImportTransactions.length === 0) {
            setNotification('No transactions to suggest categories for.');
            return;
        }

        setNotification('Getting AI category suggestions...');
        
        // Update all transactions to show they're being processed
        setPendingImportTransactions(prev =>
            prev.map(tx => ({
                ...tx,
                isSuggesting: true,
                suggestionError: null,
            }))
        );

        // Process suggestions in batches to avoid overwhelming the API
        const batchSize = 5;
        const selectedTransactions = pendingImportTransactions.filter(tx => tx.selected);
        
        for (let i = 0; i < selectedTransactions.length; i += batchSize) {
            const batch = selectedTransactions.slice(i, i + batchSize);
            
            await Promise.all(
                batch.map(async (tx, batchIndex) => {
                    const globalIndex = pendingImportTransactions.findIndex(
                        t => t.rawLine === tx.rawLine && t.date === tx.date && t.description === tx.description
                    );
                    
                    if (globalIndex === -1) return;

                    try {
                        const response = await fetch('/api/transactions/suggest-category', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                transactionName: tx.description,
                                amount: tx.amount,
                                date: tx.date,
                            }),
                        });

                        const suggestion = await response.json();

                        if (response.ok && suggestion.categoryId) {
                            setPendingImportTransactions(prev =>
                                prev.map((t, idx) =>
                                    idx === globalIndex
                                        ? {
                                              ...t,
                                              suggestedCategoryId: suggestion.categoryId,
                                              suggestedCategoryName: suggestion.categoryName,
                                              suggestionConfidence: suggestion.confidence,
                                              suggestionReasoning: suggestion.reasoning,
                                              isSuggesting: false,
                                          }
                                        : t
                                )
                            );
                        } else {
                            setPendingImportTransactions(prev =>
                                prev.map((t, idx) =>
                                    idx === globalIndex
                                        ? {
                                              ...t,
                                              isSuggesting: false,
                                              suggestionError: suggestion.error || 'No suggestion available',
                                          }
                                        : t
                                )
                            );
                        }
                    } catch (error) {
                        console.error('Suggestion error:', error);
                        setPendingImportTransactions(prev =>
                            prev.map((t, idx) =>
                                idx === globalIndex
                                    ? {
                                          ...t,
                                          isSuggesting: false,
                                          suggestionError: 'Failed to get suggestion',
                                      }
                                    : t
                            )
                        );
                    }
                })
            );
        }

        setNotification('Category suggestions complete! Review and accept/reject as needed.');
    };

    const handleAcceptSuggestion = (index: number) => {
        setPendingImportTransactions(prev =>
            prev.map((tx, i) =>
                i === index && tx.suggestedCategoryId
                    ? {
                          ...tx,
                          categoryId: tx.suggestedCategoryId,
                          categoryName: undefined, // Clear typed name when accepting suggestion
                          suggestedCategoryId: undefined,
                          suggestedCategoryName: undefined,
                      }
                    : tx
            )
        );
    };

    const handleRejectSuggestion = (index: number) => {
        setPendingImportTransactions(prev =>
            prev.map((tx, i) =>
                i === index
                    ? {
                          ...tx,
                          suggestedCategoryId: undefined,
                          suggestedCategoryName: undefined,
                          suggestionConfidence: undefined,
                          suggestionReasoning: undefined,
                      }
                    : tx
            )
        );
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

        // Require account selection for imports
        if (!importAccountId) {
            setNotification('Please select an account before importing a file.');
            event.target.value = '';
            return;
        }

        setImporting(true);
        setNotification(null);

        try {
            // Check file type and route to appropriate handler
            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                // Handle PDF upload - parse only (no DB insert)
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/import/pdf/parse', {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();

                if (!response.ok) {
                    setNotification(
                        result.message || result.error || 'Error parsing PDF. Check console/logs.'
                    );
                    return;
                }

                // Convert to pending transactions with selected=true by default
                const pending: PendingTransaction[] = result.transactions.map((tx: any) => ({
                    rawLine: tx.rawLine,
                    date: tx.date,
                    description: tx.description,
                    amount: tx.amount,
                    categoryId: null,
                    selected: true,
                    isTransfer: false,
                    transferToAccountId: null,
                }));

                // Check for duplicates and auto-categorize
                await checkDuplicatesAndAutoCategorize(pending);
                return;
            }

            // CSV handling - parse and show preview (same as PDF)
            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
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
                // Split headers, handling quoted values properly
                const headers: string[] = [];
                let currentHeader = '';
                let inQuotes = false;
                
                for (let i = 0; i < headerLine.length; i++) {
                    const char = headerLine[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        headers.push(currentHeader.trim().toLowerCase());
                        currentHeader = '';
                    } else {
                        currentHeader += char;
                    }
                }
                if (currentHeader) {
                    headers.push(currentHeader.trim().toLowerCase());
                }

                // Helper function to check if header contains any of the keywords
                const findColumnIndex = (keywords: string[]): number => {
                    // Try exact matches first, then partial matches
                    for (const keyword of keywords) {
                        const exactMatch = headers.findIndex(h => {
                            const cleaned = h.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
                            return cleaned === keyword;
                        });
                        if (exactMatch !== -1) return exactMatch;
                    }
                    
                    // Try partial matches
                    return headers.findIndex(h => {
                        // Remove extra characters like "(USD)", parentheses, etc.
                        const cleaned = h.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
                        return keywords.some(keyword => {
                            const lowerKeyword = keyword.toLowerCase();
                            const lowerCleaned = cleaned.toLowerCase();
                            return lowerCleaned === lowerKeyword || 
                                   lowerCleaned.includes(lowerKeyword) ||
                                   lowerCleaned.startsWith(lowerKeyword) ||
                                   lowerCleaned.endsWith(lowerKeyword);
                        });
                    });
                };

                // Find date column - flexible matching
                const dateIdx = findColumnIndex([
                    'date',
                    'transaction date',
                    'clearing date',
                    'posting date',
                    'post date',
                    'transactiondate',
                    'clearingdate',
                    'postingdate'
                ]);

                // Find description column - flexible matching
                const descIdx = findColumnIndex([
                    'description',
                    'descriptions',
                    'details',
                    'detail',
                    'memo',
                    'memos',
                    'payee',
                    'payees',
                    'merchant',
                    'merchants',
                    'vendor',
                    'vendors',
                    'narrative',
                    'notes'
                ]);

                // Find amount column - flexible matching
                const amountIdx = findColumnIndex([
                    'amount',
                    'amount (usd)',
                    'amount(usd)',
                    'transaction amount',
                    'amount usd',
                    'debit',
                    'credits',
                    'credit',
                    'total',
                    'value',
                    'price'
                ]);

                if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
                    // Log headers for debugging
                    console.log('CSV Headers detected:', headers);
                    console.log('Date index:', dateIdx, 'Description index:', descIdx, 'Amount index:', amountIdx);
                    setNotification(
                        `Could not detect date/description/amount columns. Found headers: ${headers.join(', ')}. Expected columns like: date, description, amount.`
                    );
                    return;
                }

                // Helper function to parse CSV line handling quoted values
                const parseCSVLine = (line: string): string[] => {
                    const cols: string[] = [];
                    let currentCol = '';
                    let inQuotes = false;
                    
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            cols.push(currentCol.trim());
                            currentCol = '';
                        } else {
                            currentCol += char;
                        }
                    }
                    if (currentCol) {
                        cols.push(currentCol.trim());
                    }
                    return cols;
                };

                const parsed: PendingTransaction[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) continue; // Skip empty lines

                    // Parse CSV line properly handling quoted values
                    const cols = parseCSVLine(line);
                    if (cols.length < Math.max(dateIdx, descIdx, amountIdx) + 1) {
                        continue;
                    }

                    const rawDate = cols[dateIdx] || '';
                    const rawDesc = cols[descIdx] || '';
                    const rawAmount = cols[amountIdx] || '';

                    const date = normalizeDate(rawDate);
                    const amount = normalizeAmount(rawAmount);

                    if (!date || amount === null) {
                        continue;
                    }

                    parsed.push({
                        rawLine: line,
                        date,
                        description: rawDesc?.slice(0, 255) ?? '',
                        amount,
                        categoryId: null,
                        selected: true,
                        isTransfer: false,
                        transferToAccountId: null,
                    });
                }

                if (parsed.length === 0) {
                    setNotification(
                        'No valid rows found to import. Check your CSV format and try again.'
                    );
                    return;
                }

                // Check for duplicates and auto-categorize
                await checkDuplicatesAndAutoCategorize(parsed);
                return;
            } else {
                setNotification('Unsupported file type. Please upload a CSV or PDF file.');
            }
        } catch (err) {
            console.error('Import failed:', err);
            setNotification('Error reading file. Make sure it is a CSV or PDF and try again.');
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
        <section className="space-y-4 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base sm:text-lg font-semibold">Transactions</h2>
                    <p className="text-xs text-slate-400">
                        {transactionWindow === 'month'
                            ? 'View all activity for the selected month.'
                            : 'View all activity across all time.'}
                    </p>
                </div>

                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
                    <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 p-1">
                        <button
                            type="button"
                            onClick={() => setTransactionWindow('month')}
                            className={`rounded px-2 py-1 text-[11px] ${
                                transactionWindow === 'month'
                                    ? 'bg-amber-400 font-semibold text-black'
                                    : 'text-slate-300 hover:bg-slate-800'
                            }`}
                        >
                            This month
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionWindow('all')}
                            className={`rounded px-2 py-1 text-[11px] ${
                                transactionWindow === 'all'
                                    ? 'bg-amber-400 font-semibold text-black'
                                    : 'text-slate-300 hover:bg-slate-800'
                            }`}
                        >
                            All time
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={goToPrevMonth}
                        disabled={transactionWindow === 'all'}
                        className="rounded-md border border-slate-700 bg-slate-950 px-4 py-2 hover:bg-slate-800 active:bg-slate-900 transition-colors"
                        aria-label="Previous month"
                    >
                        ◀
                    </button>
                    <span className="min-w-[120px] text-center font-medium">
                        {transactionWindow === 'month' ? monthLabel : 'All time'}
                    </span>
                    <button
                        type="button"
                        onClick={goToNextMonth}
                        disabled={transactionWindow === 'all'}
                        className="rounded-md border border-slate-700 bg-slate-950 px-4 py-2 hover:bg-slate-800 active:bg-slate-900 transition-colors"
                        aria-label="Next month"
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

            {/* 🆕 Transaction form */}
            {showTransactionForm && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-6 text-xs sm:text-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-semibold">
                            {editingId ? 'Edit transaction' : 'Add transaction'}
                        </h3>
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-slate-400 hover:text-slate-200 p-2 -mr-2 active:opacity-70"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                    
                    {/* Transaction type selector - always show, including when editing */}
                    <div className="mb-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setTransactionType('transaction')}
                            className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-colors active:scale-[0.98] ${
                                transactionType === 'transaction'
                                    ? 'bg-amber-400 text-black'
                                    : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 active:bg-slate-900'
                            }`}
                        >
                            Transaction
                        </button>
                        <button
                            type="button"
                            onClick={() => setTransactionType('transfer')}
                            className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-colors active:scale-[0.98] ${
                                transactionType === 'transfer'
                                    ? 'bg-amber-400 text-black'
                                    : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 active:bg-slate-900'
                            }`}
                        >
                            Transfer
                        </button>
                    </div>

                    <form onSubmit={transactionType === 'transfer' ? handleCreateTransfer : handleSaveTransaction} className="space-y-4 mt-3">
                        <div className="space-y-2">
                            <label className="block text-sm text-slate-300">Date</label>
                            <input
                                type="date"
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>
                        {transactionType === 'transfer' ? (
                            <>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-1">
                                        <label className="block text-slate-300">From Account</label>
                                        <select
                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                            value={transferFromAccount}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setTransferFromAccount(value);
                                                setIsAddingTransferFromAccount(value === '__add_new__');
                                                if (value !== '__add_new__') {
                                                    setNewTransferFromAccountName('');
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">Select account</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name}
                                                </option>
                                            ))}
                                            <option value="__add_new__">+ Add new account...</option>
                                        </select>
                                        {isAddingTransferFromAccount && (
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                                    value={newTransferFromAccountName}
                                                    onChange={e =>
                                                        setNewTransferFromAccountName(e.target.value)
                                                    }
                                                    placeholder="New source account name"
                                                    required
                                                />
                                                <select
                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                                    value={newTransferFromAccountType}
                                                    onChange={e =>
                                                        setNewTransferFromAccountType(
                                                            e.target.value as AccountType
                                                        )
                                                    }
                                                >
                                                    <option value="checking">Checking</option>
                                                    <option value="savings">Savings</option>
                                                    <option value="credit">Credit</option>
                                                    <option value="cash">Cash</option>
                                                    <option value="investment">Investment</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-slate-300">To Account</label>
                                        <select
                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                            value={transferToAccount}
                                            onChange={e => {
                                                const value = e.target.value;
                                                setTransferToAccount(value);
                                                setIsAddingTransferToAccount(value === '__add_new__');
                                                if (value !== '__add_new__') {
                                                    setNewTransferToAccountName('');
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">Select account</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name}
                                                </option>
                                            ))}
                                            <option value="__add_new__">+ Add new account...</option>
                                        </select>
                                        {isAddingTransferToAccount && (
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <input
                                                    type="text"
                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                                    value={newTransferToAccountName}
                                                    onChange={e =>
                                                        setNewTransferToAccountName(e.target.value)
                                                    }
                                                    placeholder="New destination account name"
                                                    required
                                                />
                                                <select
                                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                                    value={newTransferToAccountType}
                                                    onChange={e =>
                                                        setNewTransferToAccountType(
                                                            e.target.value as AccountType
                                                        )
                                                    }
                                                >
                                                    <option value="checking">Checking</option>
                                                    <option value="savings">Savings</option>
                                                    <option value="credit">Credit</option>
                                                    <option value="cash">Cash</option>
                                                    <option value="investment">Investment</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <label className="block text-slate-300">Type</label>
                                    <select
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                        value={expenseIncomeType}
                                        onChange={e => {
                                            setExpenseIncomeType(e.target.value as 'expense' | 'income');
                                            // Update amount sign when type changes
                                            if (amount) {
                                                const numAmount = Number(amount);
                                                if (e.target.value === 'expense' && numAmount > 0) {
                                                    setAmount('-' + Math.abs(numAmount).toString());
                                                } else if (e.target.value === 'income' && numAmount < 0) {
                                                    setAmount(Math.abs(numAmount).toString());
                                                }
                                            }
                                        }}
                                    >
                                        <option value="expense">⬇️ Expense</option>
                                        <option value="income">⬆️ Income</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-slate-300">Account</label>
                                    <select
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
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
                                    <div className="space-y-1">
                                        <select
                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                            value={isAddingFormCategory ? '__add_new__' : categoryId}
                                            onChange={e => {
                                                const value = e.target.value;
                                                if (value === '__add_new__') {
                                                    setIsAddingFormCategory(true);
                                                    setCategoryId('');
                                                    setCategoryName('');
                                                } else {
                                                    setIsAddingFormCategory(false);
                                                    setCategoryId(value);
                                                    if (value) setCategoryName('');
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">Select category...</option>
                                            {categories
                                                .filter(
                                                    c =>
                                                        c.kind === 'category' &&
                                                        categoryAllowedForTxType(
                                                            c.type,
                                                            expenseIncomeType
                                                        )
                                                )
                                                .map(cat => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.type === 'income'
                                                            ? '⬆️'
                                                            : cat.type === 'transfer'
                                                                ? '💱'
                                                                : '⬇️'}{' '}
                                                        {cat.name}
                                                    </option>
                                                ))}
                                            <option value="__add_new__">+ Add new category...</option>
                                        </select>
                                        {isAddingFormCategory && (
                                            <input
                                                type="text"
                                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                                value={categoryName}
                                                onChange={e => setCategoryName(e.target.value)}
                                                placeholder="New category name"
                                                required
                                            />
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="space-y-1">
                            <label className="block text-slate-300">Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                min={transactionType === 'transfer' ? '0.01' : undefined}
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder={transactionType === 'transfer' ? '100.00' : (expenseIncomeType === 'expense' ? '45.23' : '100.00')}
                                required
                            />
                            {transactionType === 'transfer' ? (
                                <p className="text-[10px] text-slate-500">
                                    Enter the amount to transfer (positive number).
                                </p>
                            ) : (
                                <p className="text-[10px] text-slate-500">
                                    {expenseIncomeType === 'expense' 
                                        ? 'Enter amount as positive number (will be saved as negative)'
                                        : 'Enter amount as positive number'}
                                </p>
                            )}
                        </div>
                        {transactionType === 'transfer' && (
                            <div className="space-y-1">
                                <label className="block text-slate-300">Memo (optional)</label>
                                <input
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="e.g. Rent, credit card payment"
                                />
                            </div>
                        )}
                        {transactionType === 'transaction' && (
                            <>
                                <div className="space-y-1">
                                    <label className="block text-slate-300">
                                        Transaction Name *
                                    </label>
                                    <input
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-base"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="ex. Giant groceries, date night, etc."
                                    />
                                </div>
                                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 shrink-0"
                                        checked={applyCategoryToMatchingDescriptions}
                                        onChange={e =>
                                            setApplyCategoryToMatchingDescriptions(e.target.checked)
                                        }
                                        disabled={
                                            !merchantKeyFromNameNote(
                                                (note || '').trim() || null,
                                                null
                                            )
                                        }
                                    />
                                    <span>
                                        Apply this category to all my transactions with the same
                                        description (matches ignore case and punctuation).
                                    </span>
                                </label>
                            </>
                        )}
                        <div className="flex gap-2 mt-2">
                            {!editingId && transactionType === 'transaction' && (
                                <button
                                    type="button"
                                    onClick={(e) => handleSaveTransaction(e, true)}
                                    className="flex-1 rounded-md border border-amber-400 bg-amber-950 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900"
                                >
                                    Save & Add Another
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={transactionType === 'transfer' && creatingTransfer}
                                className={`${!editingId && transactionType === 'transaction' ? 'flex-1' : 'w-full'} rounded-md bg-amber-400 py-2 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50`}
                            >
                                {transactionType === 'transfer'
                                    ? creatingTransfer
                                        ? 'Creating...'
                                        : 'Create Transfer'
                                    : editingId
                                      ? 'Update transaction'
                                      : 'Save transaction'}
                            </button>
                            {(editingId || transactionType === 'transfer') && (
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
            
            {/* Bulk Transaction Form */}
            {showBulkTransaction && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-6 text-xs sm:text-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-semibold">
                            Bulk Add Transactions
                        </h3>
                        <button
                            type="button"
                            onClick={() => {
                                setBulkTransactions([{
                                    date: new Date().toISOString().slice(0, 10),
                                    accountId: '',
                                    categoryId: '',
                                    categoryName: '',
                                    type: 'expense',
                                    amount: '',
                                    note: '',
                                }]);
                                setShowBulkTransaction(false);
                            }}
                            className="text-slate-400 hover:text-slate-200 p-2 -mr-2 active:opacity-70"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {bulkTransactions.map((tx, index) => (
                            <div key={index} className="rounded-md border border-slate-700 bg-slate-950 p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Date</label>
                                        <input
                                            type="date"
                                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                            value={tx.date}
                                            onChange={e => {
                                                const newTxs = [...bulkTransactions];
                                                newTxs[index].date = e.target.value;
                                                setBulkTransactions(newTxs);
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Type</label>
                                        <select
                                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                            value={tx.type}
                                            onChange={e => {
                                                const newTxs = [...bulkTransactions];
                                                newTxs[index].type = e.target.value as 'expense' | 'income';
                                                setBulkTransactions(newTxs);
                                            }}
                                        >
                                            <option value="expense">⬇️ Expense</option>
                                            <option value="income">⬆️ Income</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Account</label>
                                        <select
                                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                            value={tx.accountId}
                                            onChange={e => {
                                                const newTxs = [...bulkTransactions];
                                                newTxs[index].accountId = e.target.value;
                                                setBulkTransactions(newTxs);
                                            }}
                                        >
                                            <option value="">Select</option>
                                            {accounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1">Category</label>
                                        <input
                                            type="text"
                                            list={`bulk-category-list-tx-${index}-${tx.type}`}
                                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                            value={tx.categoryName || (tx.categoryId ? categories.find(c => c.id === tx.categoryId)?.name || '' : '')}
                                            onChange={e => {
                                                const newTxs = [...bulkTransactions];
                                                const inputValue = e.target.value;
                                                newTxs[index].categoryName = inputValue;
                                                
                                                // Try to find matching category
                                                const matchingCategory = categories.find(
                                                    c =>
                                                        c.name.toLowerCase() === inputValue.toLowerCase() &&
                                                        categoryAllowedForTxType(c.type, tx.type)
                                                );
                                                
                                                if (matchingCategory) {
                                                    newTxs[index].categoryId = matchingCategory.id;
                                                } else {
                                                    newTxs[index].categoryId = ''; // Will create new category on save
                                                }
                                                
                                                setBulkTransactions(newTxs);
                                            }}
                                            placeholder="Type or select category..."
                                        />
                                            <datalist id={`bulk-category-list-tx-${index}-${tx.type}`}>
                                                {(() => {
                                                    // Organize categories into hierarchy
                                                    const groups = categories.filter(
                                                        c =>
                                                            c.kind === 'group' &&
                                                            categoryAllowedForTxType(c.type, tx.type)
                                                    );
                                                    const subcategories = categories.filter(
                                                        c =>
                                                            c.kind === 'category' &&
                                                            c.parent_id &&
                                                            categoryAllowedForTxType(c.type, tx.type)
                                                    );
                                                    const standalone = categories.filter(
                                                        c =>
                                                            c.kind === 'category' &&
                                                            !c.parent_id &&
                                                            categoryAllowedForTxType(c.type, tx.type)
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
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={tx.amount}
                                        onChange={e => {
                                            const newTxs = [...bulkTransactions];
                                            newTxs[index].amount = e.target.value;
                                            setBulkTransactions(newTxs);
                                        }}
                                        placeholder={tx.type === 'expense' ? '-45.23' : '45.23'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-slate-400 mb-1">Note (optional)</label>
                                    <input
                                        type="text"
                                        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                        value={tx.note}
                                        onChange={e => {
                                            const newTxs = [...bulkTransactions];
                                            newTxs[index].note = e.target.value;
                                            setBulkTransactions(newTxs);
                                        }}
                                        placeholder="Optional note"
                                    />
                                </div>
                                {bulkTransactions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBulkTransactions(bulkTransactions.filter((_, i) => i !== index));
                                        }}
                                        className="text-[10px] text-red-400 hover:text-red-300"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setBulkTransactions([...bulkTransactions, {
                                    date: new Date().toISOString().slice(0, 10),
                                    accountId: bulkTransactions[0]?.accountId || '',
                                    categoryId: '',
                                    categoryName: '',
                                    type: 'expense',
                                    amount: '',
                                    note: '',
                                }]);
                            }}
                            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                        >
                            + Add Another
                        </button>
                        <button
                            type="button"
                            onClick={handleBulkSave}
                            className="flex-1 rounded-md bg-amber-400 px-3 py-2 text-[11px] font-semibold text-black hover:bg-amber-300"
                        >
                            Save All ({bulkTransactions.filter(tx => tx.date && tx.accountId && tx.amount && (tx.categoryId || tx.categoryName)).length})
                        </button>
                    </div>
                </div>
            )}

            {/* 🆕 Action buttons */}
            {!showTransactionForm && !showBulkTransaction && (
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setShowBulkTransaction(true);
                        }}
                        className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                    >
                        Bulk Add
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setShowTransactionForm(true);
                            setTransactionType('transaction');
                        }}
                        className="rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                    >
                        + Add Transaction
                    </button>
                </div>
            )}

            {/* 🆕 CSV/PDF import panel */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase text-slate-400">
                            Import from bank statement
                        </p>
                        <p className="text-[11px] text-slate-300">
                            Upload a CSV or PDF bank statement (date, description, amount).
                        </p>
                    </div>
                    <input
                        type="file"
                        accept=".csv,.pdf"
                        onChange={handleFileUpload}
                        disabled={importing}
                        className="text-[11px] file:mr-2 file:rounded-md file:border file:border-slate-700 file:bg-slate-800 file:px-2 file:py-1 file:text-[11px] file:text-slate-100 hover:file:bg-slate-700"
                    />
                </div>
                
                {/* Account selection for imports */}
                <div className="space-y-1">
                    <label className="block text-[10px] text-slate-400">
                        Account (required for duplicate detection & auto-categorization)
                    </label>
                    <select
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                        value={importAccountId}
                        onChange={async (e) => {
                            const newAccountId = e.target.value;
                            setImportAccountId(newAccountId);
                            // Re-check duplicates if we have pending transactions
                            if (newAccountId && pendingImportTransactions.length > 0) {
                                await checkDuplicatesAndAutoCategorize(pendingImportTransactions);
                            }
                        }}
                    >
                        <option value="">Select account</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.name}
                            </option>
                        ))}
                    </select>
                </div>
                
                <p className="text-[10px] text-slate-500">
                    Tip: Export your bank statement as CSV with columns like:
                    <span className="font-mono"> date, description, amount</span>, or upload a PDF statement.
                </p>
            </div>

            {/* 🆕 Import Preview Panel */}
            {pendingImportTransactions.length > 0 && (
                <div className="rounded-lg border border-amber-500/50 bg-slate-900 p-4 text-xs">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-amber-400">
                                Review Before Import
                            </h3>
                            <p className="text-[10px] text-slate-400">
                                {pendingImportTransactions.filter(tx => tx.selected).length} of{' '}
                                {pendingImportTransactions.length} transactions selected
                                {pendingImportTransactions.filter(tx => tx.isDuplicate).length > 0 && (
                                    <span className="text-red-400 ml-2">
                                        • {pendingImportTransactions.filter(tx => tx.isDuplicate).length} duplicate{pendingImportTransactions.filter(tx => tx.isDuplicate).length !== 1 ? 's' : ''} found
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCancelImport}
                            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                        >
                            Cancel Import
                        </button>
                    </div>

                    {/* Bulk actions */}
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                        <button
                            type="button"
                            onClick={handleToggleSelectAllImport}
                            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                        >
                            {pendingImportTransactions.every(tx => tx.selected) ? 'Deselect All' : 'Select All'}
                        </button>
                        <button
                            type="button"
                            onClick={handleRemoveSelected}
                            disabled={!pendingImportTransactions.some(tx => tx.selected)}
                            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                            Remove Selected
                        </button>
                        {importAccountId && (
                            <button
                                type="button"
                                onClick={() => checkDuplicatesAndAutoCategorize(pendingImportTransactions)}
                                className="rounded-md border border-blue-700 bg-blue-950 px-2 py-1 text-[10px] text-blue-300 hover:bg-blue-900"
                            >
                                🔍 Re-check Duplicates
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] text-slate-400">Bulk Category:</label>
                            <select
                                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px]"
                                onChange={e => {
                                    const value = e.target.value;
                                    handleBulkCategoryApply(value === '' ? null : value);
                                }}
                                value=""
                            >
                                <option value="">Apply to selected...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.type === 'income' ? '⬆️' : '⬇️'} {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={handleSuggestCategories}
                            disabled={pendingImportTransactions.length === 0 || pendingImportTransactions.some(tx => tx.isSuggesting)}
                            className="rounded-md bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                            🤖 AI Suggest Categories
                        </button>
                    </div>

                    {/* Preview table */}
                    <div className="max-h-96 overflow-y-auto overflow-x-auto">
                        <table className="w-full border-collapse text-[10px] min-w-[600px]">
                            <thead className="sticky top-0 bg-slate-950">
                                <tr className="border-b border-slate-800">
                                    <th className="p-2 text-left">
                                        <input
                                            type="checkbox"
                                            checked={pendingImportTransactions.every(tx => tx.selected)}
                                            onChange={handleToggleSelectAllImport}
                                            className="rounded border-slate-600"
                                        />
                                    </th>
                                    <th className="p-2 text-left text-slate-400">Date</th>
                                    <th className="p-2 text-left text-slate-400">Description</th>
                                    <th className="p-2 text-right text-slate-400">Amount</th>
                                    <th className="p-2 text-left text-slate-400">Category</th>
                                    <th className="p-2 text-left text-slate-400">Transfer</th>
                                    <th className="p-2 text-left text-slate-400">To Account</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingImportTransactions.map((tx, index) => (
                                    <tr
                                        key={index}
                                        className={`border-b border-slate-800 ${
                                            tx.selected ? 'bg-slate-950/50' : ''
                                        } ${
                                            tx.isDuplicate ? 'bg-red-950/30 border-red-800/50' : ''
                                        }`}
                                    >
                                        <td className="p-2">
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={tx.selected}
                                                    onChange={() => handleToggleSelect(index)}
                                                    className="rounded border-slate-600"
                                                    disabled={tx.isDuplicate}
                                                />
                                                {tx.isDuplicate && (
                                                    <span className="text-[8px] text-red-400" title="Duplicate transaction">
                                                        ⚠️
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="date"
                                                value={tx.date}
                                                onChange={e => handleUpdatePendingTransaction(index, 'date', e.target.value)}
                                                className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="text"
                                                value={tx.description}
                                                onChange={e => handleUpdatePendingTransaction(index, 'description', e.target.value)}
                                                className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
                                            />
                                        </td>
                                        <td className="p-2 text-right">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={tx.amount}
                                                onChange={e => handleUpdatePendingTransaction(index, 'amount', parseFloat(e.target.value) || 0)}
                                                className="w-24 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-right text-[10px]"
                                            />
                                        </td>
                                        <td className="p-2">
                                            {tx.isDuplicate ? (
                                                <div className="text-[9px] text-red-400">
                                                    Duplicate (deselected)
                                                </div>
                                            ) : tx.isSuggesting ? (
                                                <div className="text-[9px] text-slate-500">Loading...</div>
                                            ) : tx.suggestedCategoryId && !tx.categoryId ? (
                                                <div className="space-y-1">
                                                    <div className="text-[9px] text-blue-400">
                                                        💡 {tx.suggestedCategoryName} ({Math.round((tx.suggestionConfidence || 0) * 100)}%)
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAcceptSuggestion(index)}
                                                            className="flex-1 rounded bg-emerald-600 px-1 py-0.5 text-[8px] text-white hover:bg-emerald-500"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRejectSuggestion(index)}
                                                            className="flex-1 rounded bg-red-600 px-1 py-0.5 text-[8px] text-white hover:bg-red-500"
                                                        >
                                                            ✗
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <select
                                                        className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
                                                        value={tx.isAddingCategory ? '__add_new__' : (tx.categoryId || '')}
                                                        onChange={e => {
                                                            const value = e.target.value;
                                                            if (value === '__add_new__') {
                                                                handleUpdatePendingTransaction(index, 'isAddingCategory', true);
                                                                handleUpdatePendingTransaction(index, 'categoryId', null);
                                                                handleUpdatePendingTransaction(index, 'categoryName', '');
                                                            } else {
                                                                handleUpdatePendingTransaction(index, 'isAddingCategory', false);
                                                                handleUpdatePendingTransaction(index, 'categoryId', value || null);
                                                                if (value) {
                                                                    handleUpdatePendingTransaction(index, 'categoryName', undefined);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Select category...</option>
                                                        {categories.map(cat => (
                                                            <option key={cat.id} value={cat.id}>
                                                                {cat.type === 'income' ? '⬆️' : '⬇️'} {cat.name}
                                                            </option>
                                                        ))}
                                                        <option value="__add_new__">+ Add new category...</option>
                                                    </select>
                                                    {tx.isAddingCategory && (
                                                        <input
                                                            type="text"
                                                            className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
                                                            value={tx.categoryName || ''}
                                                            onChange={e =>
                                                                handleUpdatePendingTransaction(
                                                                    index,
                                                                    'categoryName',
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder="New category name"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="checkbox"
                                                checked={tx.isTransfer || false}
                                                onChange={e => {
                                                    handleUpdatePendingTransaction(index, 'isTransfer', e.target.checked);
                                                    if (!e.target.checked) {
                                                        handleUpdatePendingTransaction(index, 'transferToAccountId', null);
                                                    }
                                                }}
                                                className="rounded border-slate-600"
                                            />
                                        </td>
                                        <td className="p-2">
                                            {tx.isTransfer ? (
                                                <select
                                                    value={tx.transferToAccountId || ''}
                                                    onChange={e => handleUpdatePendingTransaction(index, 'transferToAccountId', e.target.value || null)}
                                                    className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
                                                >
                                                    <option value="">Select account...</option>
                                                    {accounts.filter(a => a.id !== importAccountId).map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="text-[10px] text-slate-500">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Commit button */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                        <p className="text-[10px] text-slate-400">
                            Account: {accounts.find(a => a.id === importAccountId)?.name || 'Not selected'}
                        </p>
                        <button
                            type="button"
                            onClick={handleCommitImport}
                            disabled={importing || !importAccountId || pendingImportTransactions.filter(tx => tx.selected).length === 0}
                            className="rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                        >
                            {importing
                                ? 'Importing...'
                                : `Import ${pendingImportTransactions.filter(tx => tx.selected).length} Transaction${pendingImportTransactions.filter(tx => tx.selected).length !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            )}

            {/* Month summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase text-slate-400">Income</p>
                    <p className="text-xl font-semibold text-emerald-400">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(totalIn)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase text-slate-400">Expenses</p>
                    <p className="text-xl font-semibold text-red-400">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(totalOut)}
                    </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="text-[10px] uppercase text-slate-400">Net</p>
                    <p
                        className={`text-xl font-semibold ${
                            net >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                    >
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(net)}
                    </p>
                </div>
            </div>

            {/* Transactions list */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">All transactions</h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-[10px] text-slate-400">Category filter</label>
                        <select
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                            value={categoryFilterId}
                            onChange={e => setCategoryFilterId(e.target.value)}
                        >
                            <option value="">All categories</option>
                            <option value="__uncategorized__">Uncategorized</option>
                            {categories
                                .filter(c => c.kind === 'category')
                                .map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                        </select>
                        <label className="ml-2 text-[10px] text-slate-400">Sort</label>
                        <select
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                            value={sortMode}
                            onChange={e =>
                                setSortMode(
                                    e.target.value as
                                        | 'date_desc'
                                        | 'merchant_frequency'
                                        | 'amount_desc'
                                        | 'amount_asc'
                                )
                            }
                        >
                            <option value="date_desc">Newest first</option>
                            <option value="merchant_frequency">Merchant frequency</option>
                            <option value="amount_desc">Amount: high → low</option>
                            <option value="amount_asc">Amount: low → high</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <p className="text-slate-400">Loading…</p>
                ) : visibleTransactions.length === 0 ? (
                    <p className="text-slate-400">
                        {transactionWindow === 'month'
                            ? `No matching transactions for ${monthLabel} with this filter.`
                            : 'No matching transactions across all time with this filter.'}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {merchantFrequencyRows.length > 0 && (
                            <div className="rounded-md border border-slate-800 bg-slate-950 p-2">
                                <p className="mb-1 text-[10px] uppercase text-slate-400">
                                    Top Merchants/Descriptions (by frequency)
                                </p>
                                <div className="max-h-28 space-y-1 overflow-y-auto text-[10px]">
                                    {merchantFrequencyRows.slice(0, 8).map(row => (
                                        <div
                                            key={row.key}
                                            className="flex items-center justify-between gap-2 text-slate-300"
                                        >
                                            <span className="truncate">{row.label}</span>
                                            <span className="shrink-0 text-slate-400">
                                                {row.count} tx
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bulk Edit Controls */}
                        {selectedTransactionIds.size > 0 && (
                            <div className="rounded-lg border border-amber-700 bg-slate-900 p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-amber-400">
                                        {selectedTransactionIds.size} transaction{selectedTransactionIds.size !== 1 ? 's' : ''} selected
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowBulkEdit(!showBulkEdit)}
                                            className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-semibold text-black hover:bg-amber-300"
                                        >
                                            {showBulkEdit ? 'Cancel' : 'Bulk Edit'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleBulkDelete}
                                            disabled={bulkUpdating}
                                            className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                                        >
                                            Delete Selected
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedTransactionIds(new Set());
                                                setShowBulkEdit(false);
                                            }}
                                            className="rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {showBulkEdit && (
                                    <div className="mt-3 space-y-2 rounded-md bg-slate-950 p-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1">Category</label>
                                                <select
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                    value={bulkEditCategory}
                                                    onChange={e => setBulkEditCategory(e.target.value)}
                                                >
                                                    <option value="">Keep existing</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>
                                                            {cat.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1">Account</label>
                                                <select
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                    value={bulkEditAccount}
                                                    onChange={e => setBulkEditAccount(e.target.value)}
                                                    disabled={bulkCategoryIsTransfer}
                                                >
                                                    <option value="">Keep existing</option>
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1">Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                    value={bulkEditDate}
                                                    onChange={e => setBulkEditDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        {bulkCategoryIsTransfer && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] text-slate-400 mb-1">
                                                        Transfer From Account
                                                    </label>
                                                    <select
                                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                        value={bulkTransferFromAccount}
                                                        onChange={e => setBulkTransferFromAccount(e.target.value)}
                                                    >
                                                        <option value="">Select source account</option>
                                                        {accounts.map(acc => (
                                                            <option key={acc.id} value={acc.id}>
                                                                {acc.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-400 mb-1">
                                                        Transfer To Account
                                                    </label>
                                                    <select
                                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                        value={bulkTransferToAccount}
                                                        onChange={e => setBulkTransferToAccount(e.target.value)}
                                                    >
                                                        <option value="">Select destination account</option>
                                                        {accounts
                                                            .filter(acc => acc.id !== bulkTransferFromAccount)
                                                            .map(acc => (
                                                                <option key={acc.id} value={acc.id}>
                                                                    {acc.name}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleBulkUpdate}
                                            disabled={bulkUpdating}
                                            className="w-full rounded-md bg-amber-400 px-3 py-2 text-[11px] font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                                        >
                                            {bulkUpdating ? 'Updating...' : `Update ${selectedTransactionIds.size} Transaction${selectedTransactionIds.size !== 1 ? 's' : ''}`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Transaction List */}
                        <div className="max-h-[540px] space-y-2 overflow-y-auto">
                            {/* Select All Checkbox */}
                            {displayedTransactions.length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-slate-400">
                                    <input
                                        type="checkbox"
                                        checked={
                                            displayedTransactions.length > 0 &&
                                            displayedTransactions.every(tx =>
                                                selectedTransactionIds.has(tx.id)
                                            )
                                        }
                                        onChange={handleToggleSelectAll}
                                        className="rounded border-slate-600"
                                    />
                                    <label>Select all visible transactions</label>
                                </div>
                            )}

                            {displayedTransactions.map(tx => (
                                <div
                                    key={tx.id}
                                    className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                                        tx.is_transfer
                                            ? 'border-blue-700 bg-slate-950'
                                            : selectedTransactionIds.has(tx.id)
                                                ? 'border-amber-600 bg-slate-900'
                                                : 'border-slate-800 bg-slate-950'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTransactionIds.has(tx.id)}
                                        onChange={() => handleToggleSelectTransaction(tx.id)}
                                        className="rounded border-slate-600"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium">
                                            {tx.is_transfer && (
                                                <span className="mr-1 text-blue-400">↔</span>
                                            )}
                                            {tx.category ||
                                                (tx.is_transfer ? 'Transfer' : 'Uncategorized')}{' '}
                                            •{' '}
                                            {tx.account || 'No account'}
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            {tx.date} • {tx.name || tx.person}
                                            {tx.pending ? (
                                                <span className="ml-1 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] text-amber-200">
                                                    Pending
                                                </span>
                                            ) : null}
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
                                            {new Intl.NumberFormat('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            }).format(Math.abs(tx.amount))}
                                        </div>
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
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
