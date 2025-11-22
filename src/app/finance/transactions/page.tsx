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
    
    // Import preview state
    type PendingTransaction = {
        rawLine: string;
        date: string;
        description: string;
        amount: number;
        categoryId?: string | null;
        selected: boolean;
        isTransfer?: boolean;
        transferToAccountId?: string | null;
    };
    const [pendingImportTransactions, setPendingImportTransactions] = useState<PendingTransaction[]>([]);
    const [importAccountId, setImportAccountId] = useState<string>('');

    // ✅ NEW: transaction form state
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [transactionType, setTransactionType] = useState<'transaction' | 'transfer'>('transaction');
    
    // Transfer-specific state (used when transactionType === 'transfer')
    const [transferFromAccount, setTransferFromAccount] = useState<string>('');
    const [transferToAccount, setTransferToAccount] = useState<string>('');
    const [creatingTransfer, setCreatingTransfer] = useState(false);
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

    // Bulk edit state
    const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [bulkEditCategory, setBulkEditCategory] = useState<string>('');
    const [bulkEditAccount, setBulkEditAccount] = useState<string>('');
    const [bulkEditDate, setBulkEditDate] = useState<string>('');
    const [bulkUpdating, setBulkUpdating] = useState(false);

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
        setTransactionType('transaction');
        setTransferFromAccount('');
        setTransferToAccount('');
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
        const nonTransferTransactions = transactions.filter(tx => !tx.is_transfer);
        if (selectedTransactionIds.size === nonTransferTransactions.length) {
            setSelectedTransactionIds(new Set());
        } else {
            setSelectedTransactionIds(new Set(nonTransferTransactions.map(tx => tx.id)));
        }
    };

    const handleBulkUpdate = async () => {
        if (selectedTransactionIds.size === 0) {
            setNotification('Please select at least one transaction to update.');
            return;
        }

        setBulkUpdating(true);
        setNotification(null);

        try {
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

            const ids = Array.from(selectedTransactionIds);
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

            setNotification(`Successfully updated ${ids.length} transaction${ids.length !== 1 ? 's' : ''}.`);
            setSelectedTransactionIds(new Set());
            setShowBulkEdit(false);
            setBulkEditCategory('');
            setBulkEditAccount('');
            setBulkEditDate('');
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

        if (typeof window !== 'undefined') {
            const ok = window.confirm(`Delete ${selectedTransactionIds.size} selected transaction${selectedTransactionIds.size !== 1 ? 's' : ''}?`);
            if (!ok) return;
        }

        setBulkUpdating(true);
        setNotification(null);

        try {
            const ids = Array.from(selectedTransactionIds);
            const { error } = await supabase
                .from('transactions')
                .delete()
                .in('id', ids);

            if (error) {
                console.error('Bulk delete error:', error);
                setNotification(`Error deleting transactions: ${error.message}`);
                setBulkUpdating(false);
                return;
            }

            setNotification(`Successfully deleted ${ids.length} transaction${ids.length !== 1 ? 's' : ''}.`);
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

        if (transferFromAccount === transferToAccount) {
            setNotification('From and To accounts must be different.');
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
            // Generate a new UUID for the transfer group
            const transferGroupId = crypto.randomUUID();

            // Get account names for the person field
            const fromAccount = accounts.find(a => a.id === transferFromAccount);
            const toAccount = accounts.find(a => a.id === transferToAccount);
            const transferLabel = `Transfer: ${fromAccount?.name ?? 'Unknown'} → ${toAccount?.name ?? 'Unknown'}`;

            // Create two linked transactions
            const { error } = await supabase.from('transactions').insert([
                {
                    date,
                    amount: -numAmount, // Negative: money leaving source account
                    person: transferLabel,
                    note: note || null,
                    account_id: transferFromAccount,
                    category_id: null,
                    is_transfer: true,
                    transfer_group_id: transferGroupId,
                },
                {
                    date,
                    amount: numAmount, // Positive: money entering destination account
                    person: transferLabel,
                    note: note || null,
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
            setAmount('0');
            setNote('');
            setDate(new Date().toISOString().slice(0, 10));
            setTransactionType('transaction');
            setShowTransactionForm(false);

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
                const response = await fetch('/api/import/commit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        accountId: importAccountId,
                        transactions: regularTransactions.map(tx => ({
                            date: tx.date,
                            description: tx.description,
                            amount: tx.amount,
                            categoryId: tx.categoryId || null,
                        })),
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
                                category_id: null,
                                is_transfer: true,
                                transfer_group_id: transferGroupId,
                            },
                            {
                                date: transfer.date,
                                amount: Math.abs(transfer.amount),
                                person: `Transfer: ${fromAccountName} → ${toAccountName}`,
                                note: transfer.description || null,
                                account_id: transfer.transferToAccountId,
                                category_id: null,
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
        field: 'date' | 'description' | 'amount' | 'categoryId' | 'isTransfer' | 'transferToAccountId',
        value: string | number | boolean | null
    ) => {
        setPendingImportTransactions(prev =>
            prev.map((tx, i) => {
                if (i === index) {
                    return { ...tx, [field]: value };
                }
                return tx;
            })
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

                setPendingImportTransactions(pending);
                setNotification(
                    `Parsed ${result.count} transactions. Review and confirm below.`
                );
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

                const parsed: PendingTransaction[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];

                    // naive split – fine for first version
                    const cols = line.split(',');
                    if (cols.length < headers.length) {
                        continue;
                    }

                    const rawDate = cols[dateIdx];
                    const rawDesc = cols[descIdx];
                    const rawAmount = cols[amountIdx];

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

                // Show preview (same as PDF)
                setPendingImportTransactions(parsed);
                setNotification(
                    `Parsed ${parsed.length} transactions. Review and confirm below.`
                );
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
                    
                    {/* Transaction type selector (only show when not editing) */}
                    {!editingId && (
                        <div className="mb-3 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setTransactionType('transaction')}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                    transactionType === 'transaction'
                                        ? 'bg-amber-400 text-black'
                                        : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                Transaction
                            </button>
                            <button
                                type="button"
                                onClick={() => setTransactionType('transfer')}
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                    transactionType === 'transfer'
                                        ? 'bg-amber-400 text-black'
                                        : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                Transfer
                            </button>
                        </div>
                    )}

                    <form onSubmit={transactionType === 'transfer' ? handleCreateTransfer : handleSaveTransaction} className="space-y-3 mt-3">
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
                        {transactionType === 'transfer' ? (
                            <>
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
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                        <div className="space-y-1">
                            <label className="block text-slate-300">Amount</label>
                            <input
                                type="number"
                                step="0.01"
                                min={transactionType === 'transfer' ? '0.01' : undefined}
                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                required
                            />
                            {transactionType === 'transfer' ? (
                                <p className="text-[10px] text-slate-500">
                                    Enter the amount to transfer (positive number).
                                </p>
                            ) : (
                                <p className="text-[10px] text-slate-500">
                                    Use positive for income, negative for expenses (e.g. -45.23
                                    for groceries).
                                </p>
                            )}
                        </div>
                        {transactionType === 'transaction' && (
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
                        )}
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
                                disabled={transactionType === 'transfer' && creatingTransfer}
                                className="flex-1 rounded-md bg-amber-400 py-2 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
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

            {/* 🆕 Action buttons */}
            {!showTransactionForm && (
                <div className="flex justify-end gap-2">
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
                
                {/* Account selection for PDF imports */}
                <div className="space-y-1">
                    <label className="block text-[10px] text-slate-400">
                        Account (required for PDF imports)
                    </label>
                    <select
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
                        value={importAccountId}
                        onChange={e => setImportAccountId(e.target.value)}
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
                    </div>

                    {/* Preview table */}
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full border-collapse text-[10px]">
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
                                        }`}
                                    >
                                        <td className="p-2">
                                            <input
                                                type="checkbox"
                                                checked={tx.selected}
                                                onChange={() => handleToggleSelect(index)}
                                                className="rounded border-slate-600"
                                            />
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
                                            <select
                                                value={tx.categoryId || ''}
                                                onChange={e => handleUpdatePendingTransaction(index, 'categoryId', e.target.value || null)}
                                                className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
                                            >
                                                <option value="">None</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>
                                                        {cat.type === 'income' ? '⬆️' : '⬇️'} {cat.name}
                                                    </option>
                                                ))}
                                            </select>
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
                    <div className="space-y-3">
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
                                        <div className="grid grid-cols-3 gap-2">
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
                            {transactions.filter(tx => !tx.is_transfer).length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-slate-400">
                                    <input
                                        type="checkbox"
                                        checked={
                                            transactions.filter(tx => !tx.is_transfer).length > 0 &&
                                            selectedTransactionIds.size === transactions.filter(tx => !tx.is_transfer).length
                                        }
                                        onChange={handleToggleSelectAll}
                                        className="rounded border-slate-600"
                                    />
                                    <label>Select all non-transfer transactions</label>
                                </div>
                            )}

                            {transactions.map(tx => (
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
                                    {!tx.is_transfer && (
                                        <input
                                            type="checkbox"
                                            checked={selectedTransactionIds.has(tx.id)}
                                            onChange={() => handleToggleSelectTransaction(tx.id)}
                                            className="rounded border-slate-600"
                                        />
                                    )}
                                    <div className="flex-1">
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
                    </div>
                )}
            </div>
        </section>
    );
}
