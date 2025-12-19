'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';

console.log('FINANCE PAGE LOADED, URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other';

type Account = {
    id: string;
    name: string;
    type: AccountType | null;
    starting_balance: number | null;
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
    person: string;
    note: string | null;
    // display values
    account: string | null;
    category: string | null;
    // IDs for CRUD
    accountId: string | null;
    categoryId: string | null;
};

type CategoryBudget = {
    id: string;
    category_id: string;
    month: string;
    amount: number;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    person: string;
    note: string | null;
    account_id: string | null;
    category_id: string | null;
    // Supabase might return a single object or an array
    accounts:
        | { id: string | null; name: string | null }
        | { id: string | null; name: string | null }[]
        | null;
    categories:
        | { id: string | null; name: string | null }
        | { id: string | null; name: string | null }[]
        | null;
};

export default function FinancePage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
    const [loading, setLoading] = useState(true);

    // form state
    const [date, setDate] = useState<string>(() =>
        new Date().toISOString().slice(0, 10)
    );
    const [accountId, setAccountId] = useState<string>('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [categoryName, setCategoryName] = useState<string>('');
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
    const [amount, setAmount] = useState<string>('');
    const [person, setPerson] = useState<string>('Malik');
    const [note, setNote] = useState<string>('');

    // which transaction are we editing? null = adding new
    const [editingId, setEditingId] = useState<string | null>(null);

    // budget editor state
    const [budgetCategoryId, setBudgetCategoryId] = useState<string>('');
    const [budgetAmount, setBudgetAmount] = useState<string>('');

    // simple in-app notification text
    const [notification, setNotification] = useState<string | null>(null);

    // Add Transaction form visibility
    const [showAddTransaction, setShowAddTransaction] = useState<boolean>(false);
    const [showBulkTransaction, setShowBulkTransaction] = useState<boolean>(false);
    
    // Bulk transaction state
    const [bulkTransactions, setBulkTransactions] = useState<Array<{
        date: string;
        accountId: string;
        categoryId: string;
        categoryName: string;
        type: 'expense' | 'income';
        amount: string;
        person: string;
        note: string;
    }>>([{
        date: new Date().toISOString().slice(0, 10),
        accountId: '',
        categoryId: '',
        categoryName: '',
        type: 'expense',
        amount: '',
        person: 'Malik',
        note: '',
    }]);

    // month selector state: store the first day of the currently selected month
    const [monthDate, setMonthDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    // YYYY-MM string for queries and filtering
    const monthStr = useMemo(
        () =>
            `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(
                2,
                '0'
            )}`,
        [monthDate]
    );

    // Pretty label like "November 2025"
    const monthLabel = useMemo(
        () =>
            monthDate.toLocaleString('default', {
                month: 'long',
                year: 'numeric',
            }),
        [monthDate]
    );

    const goToPrevMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
        );
    };

    const goToNextMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
        );
    };

    // helper to load transactions for the currently selected month
    const reloadTransactionsForMonth = async (): Promise<Transaction[]> => {
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return [];
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

        // ✅ Only keep the date part for a DATE column
        const startStr = startOfMonth.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const endStr = endOfMonth.toISOString().slice(0, 10); // "YYYY-MM-DD"

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
            .eq('user_id', user.id)
            .gte('date', startStr)
            .lt('date', endStr)
            .order('date', { ascending: false });

        console.log('TX RESULT:', { txData, txError });

        if (txError) {
            console.error(txError);
            return [];
        }

        const rows = (txData ?? []) as TxRow[];
        const getRelName = (
            rel:
                | { id: string | null; name: string | null }
                | { id: string | null; name: string | null }[]
                | null
        ) => {
            if (!rel) return null;

            // If it's an array → use first element
            if (Array.isArray(rel)) {
                return rel.length > 0 ? rel[0].name ?? null : null;
            }

            // If it's a single object
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
            accountId: tx.account_id,
            categoryId: tx.category_id,
        }));

        setTransactions(mapped);
        return mapped;
    };

    useEffect(() => {
        console.log('FINANCE PAGE EFFECT RUNNING');

        const loadDebug = async () => {
            console.log('FINANCE: starting debug Supabase queries');

            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return;
            }

            const { data: accountsData, error: accountsError } = await supabase
                .from('accounts')
                .select('id, name, type, starting_balance')
                .eq('user_id', user.id)
                .order('name');

            console.log('FINANCE DEBUG ACCOUNTS:', { accountsData, accountsError });

            const { data: categoriesData, error: categoriesError } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .eq('user_id', user.id)
                .order('name');

            console.log('FINANCE DEBUG CATEGORIES:', {
                categoriesData,
                categoriesError,
            });
        };

        loadDebug().catch(err => {
            console.error('FINANCE DEBUG LOAD FAILED:', err);
        });
    }, []);

    // 🔥 Main data load effect
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            console.log('RUNNING SUPABASE QUERIES...');

            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            // 🔍 DEBUG: raw fetch directly to Supabase REST API
            try {
                const rawUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/accounts?select=id,name&limit=1`;
                console.log('DEBUG RAW FETCH URL:', rawUrl);

                const rawRes = await fetch(rawUrl, {
                    headers: {
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
                    },
                });

                const text = await rawRes.text();
                console.log('DEBUG RAW FETCH STATUS:', rawRes.status);
                console.log('DEBUG RAW FETCH BODY:', text);
            } catch (err) {
                console.error('DEBUG RAW FETCH ERROR:', err);
            }

            // 1) ACCOUNTS - filter by user_id
            const { data: accountsData, error: accountsError } = await supabase
                .from('accounts')
                .select('id, name, type, starting_balance')
                .eq('user_id', user.id)
                .order('name');

            console.log('ACCOUNTS RESULT:', { accountsData, accountsError });

            // 2) CATEGORIES - filter by user_id
            const { data: categoriesData, error: categoriesError } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .eq('user_id', user.id)
                .order('name');

            console.log('CATEGORIES RESULT:', { categoriesData, categoriesError });

            // 3) BUDGETS - filter by user_id
            const { data: budgetsData, error: budgetsError } = await supabase
                .from('category_budgets')
                .select('id, category_id, month, amount')
                .eq('user_id', user.id)
                .eq('month', monthStr);

            console.log('BUDGETS RESULT:', { budgetsData, budgetsError });

            setAccounts(accountsData ?? []);
            setCategories(categoriesData ?? []);
            setBudgets(budgetsData ?? []);

            // 4) TRANSACTIONS scoped to selected month
            await reloadTransactionsForMonth();

            setLoading(false);
        };

        load().catch(err => {
            console.error('LOAD() FAILED:', err);
            setLoading(false);
        });
    }, [monthDate, monthStr]);

    const thisMonthTx = useMemo(
        () => transactions.filter(tx => tx.date.startsWith(monthStr)),
        [transactions, monthStr]
    );

    const totalIn = thisMonthTx
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
    const totalOut = thisMonthTx
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
    const net = totalIn + totalOut;
    const totalIncome = totalIn;
    const totalExpenses = Math.abs(totalOut);

    // Calculate net worth from all account balances (same as accounts page)
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

    // Load all transactions for net worth calculation
    useEffect(() => {
        const loadAllTransactions = async () => {
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return;
            }

            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select('id, amount, account_id')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (txError) {
                console.error('Error loading all transactions for net worth:', txError);
                return;
            }

            const rows = (txData ?? []) as Array<{
                id: string;
                amount: number;
                account_id: string | null;
            }>;

            // Map to Transaction format (we only need account_id and amount)
            const mapped: Transaction[] = rows.map(tx => ({
                id: tx.id,
                date: '',
                amount: Number(tx.amount),
                person: '',
                note: null,
                account: null,
                category: null,
                accountId: tx.account_id,
                categoryId: null,
            }));

            setAllTransactions(mapped);
        };

        loadAllTransactions();
    }, []);

    // Calculate net change per account (from all transactions)
    const netChangeByAccountId = useMemo(() => {
        const map = new Map<string, number>();
        allTransactions.forEach(tx => {
            if (!tx.accountId) return;
            const prev = map.get(tx.accountId) ?? 0;
            map.set(tx.accountId, prev + tx.amount);
        });
        return map;
    }, [allTransactions]);

    // Helper: compute signed current balance for an account (same as accounts page)
    const getAccountBalance = (acc: Account) => {
        const netChange = netChangeByAccountId.get(acc.id) ?? 0;
        const starting = Number(acc.starting_balance ?? 0);
        const rawBalance = starting + netChange;

        // Credit accounts are liabilities: flip sign so spending shows negative
        const signedBalance = acc.type === 'credit' ? -rawBalance : rawBalance;

        return {
            starting,
            netChange,
            rawBalance,
            signedBalance,
        };
    };

    // Net worth = sum of signed balances across accounts (same as accounts page)
    const netWorth = useMemo(() => {
        return accounts.reduce((sum, acc) => {
            const { signedBalance } = getAccountBalance(acc);
            return sum + signedBalance;
        }, 0);
    }, [accounts, netChangeByAccountId]);

    // helper: spending per category for this month (expenses only, as positive number)
    const spendingByCategoryName = useMemo(() => {
        const map = new Map<string, number>();
        thisMonthTx.forEach(tx => {
            if (!tx.category) return;
            if (tx.amount >= 0) return; // only count expenses
            const prev = map.get(tx.category) || 0;
            map.set(tx.category, prev + Math.abs(tx.amount));
        });
        return map;
    }, [thisMonthTx]);

    const budgetsByCategoryId = useMemo(() => {
        const map = new Map<string, CategoryBudget>();
        budgets.forEach(b => {
            map.set(b.category_id, b);
        });
        return map;
    }, [budgets]);

    const resetFormToDefault = () => {
        setDate(new Date().toISOString().slice(0, 10));
        setAccountId('');
        setCategoryId('');
        setCategoryName('');
        setTransactionType('expense');
        setAmount('');
        setPerson('Malik');
        setNote('');
        setEditingId(null);
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

    const handleAddOrUpdateTransaction = async (e: FormEvent, addAnother: boolean = false) => {
        e.preventDefault();

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setNotification('You must be logged in to save transactions.');
            return;
        }

        const numAmount = Number(amount);
        if (!numAmount || !accountId) {
            setNotification('Please fill in all required fields.');
            return;
        }

        // Find or create category if categoryName is provided
        let finalCategoryId: string | null = categoryId || null;
        if (categoryName && !categoryId) {
            finalCategoryId = await findOrCreateCategory(categoryName, transactionType);
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

        // Ensure amount has correct sign based on transaction type
        let finalAmount = numAmount;
        if (transactionType === 'expense' && numAmount > 0) {
            finalAmount = -Math.abs(numAmount);
        } else if (transactionType === 'income' && numAmount < 0) {
            finalAmount = Math.abs(numAmount);
        }

        setNotification(null);

        if (editingId) {
            // UPDATE existing transaction
            const { error } = await supabase
                .from('transactions')
                .update({
                    date,
                    account_id: accountId,
                    category_id: finalCategoryId,
                    amount: finalAmount,
                    person,
                    note: note || null,
                })
                .eq('id', editingId)
                .eq('user_id', user.id); // Ensure user can only update their own transactions

            if (error) {
                console.error(error);
                setNotification('Error updating transaction. Check console/logs.');
                return;
            }
        } else {
            // INSERT new transaction
            const { error } = await supabase.from('transactions').insert({
                date,
                account_id: accountId,
                category_id: finalCategoryId,
                amount: finalAmount,
                person,
                note: note || null,
                user_id: user.id,
            });

            if (error) {
                console.error(error);
                setNotification('Error saving transaction. Check console/logs.');
                return;
            }
        }

        // Reload list after insert/update, scoped to the currently selected month
        const newTransactions = await reloadTransactionsForMonth();

        // compute notification about remaining budget for this category
        const selectedCategory = finalCategoryId ? categories.find(c => c.id === finalCategoryId) : null;
        const selectedCategoryName = selectedCategory?.name ?? null;

        if (selectedCategoryName) {
            if (finalCategoryId) {
                const budgetRecord = budgetsByCategoryId.get(finalCategoryId);
                if (budgetRecord) {
                    const updatedThisMonthTx = newTransactions.filter(tx =>
                        tx.date.startsWith(monthStr)
                    );
                    const updatedSpendingByCategory = new Map<string, number>();
                    updatedThisMonthTx.forEach(tx => {
                        if (!tx.category) return;
                        if (tx.amount >= 0) return;
                        const prev = updatedSpendingByCategory.get(tx.category) || 0;
                        updatedSpendingByCategory.set(
                            tx.category,
                            prev + Math.abs(tx.amount)
                        );
                    });

                    const spent =
                        updatedSpendingByCategory.get(selectedCategoryName) || 0;
                    const remaining = budgetRecord.amount - spent;

                const spentStr = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                }).format(spent);
                const remainingStr = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                }).format(remaining);
                const amountStr = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                }).format(Math.abs(finalAmount));
                const budgetStr = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                }).format(budgetRecord.amount);

                    setNotification(
                        `You just ${editingId ? 'updated' : 'logged'} ${
                            finalAmount < 0 ? '-' : '+'
                        }${amountStr} in ${selectedCategoryName}. This month: spent ${spentStr}, remaining ${remainingStr} of your ${budgetStr} budget.`
                    );
                } else {
                    const amountStrNoBudget = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                    }).format(Math.abs(finalAmount));
                    setNotification(
                        `You just ${editingId ? 'updated' : 'logged'} ${
                            finalAmount < 0 ? '-' : '+'
                        }${amountStrNoBudget} in ${selectedCategoryName}. No budget set for this category.`
                    );
                }
            }
        }

        // Reset form after successful insert (not update)
        if (!editingId) {
            if (addAnother) {
                // Keep form open and reset fields but keep account and date
                setCategoryId('');
                setCategoryName('');
                setAmount('');
                setNote('');
                setTransactionType('expense');
                // Keep accountId and date for quick entry
            } else {
                resetFormToDefault();
                setShowAddTransaction(false);
            }
        } else {
            setEditingId(null);
            resetFormToDefault();
            setShowAddTransaction(false);
        }
    };

    const handleSaveBudget = async (e: FormEvent) => {
        e.preventDefault();

        if (!budgetCategoryId) return;

        const numAmount = Number(budgetAmount);
        if (Number.isNaN(numAmount)) return;

        setNotification(null);

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setNotification('You must be logged in to save budgets.');
            return;
        }

        // Check if a budget already exists for this category + month
        const { data: existingRows, error: fetchError } = await supabase
            .from('category_budgets')
            .select('id')
            .eq('user_id', user.id)
            .eq('category_id', budgetCategoryId)
            .eq('month', monthStr)
            .limit(1);

        if (fetchError) {
            console.error(fetchError);
            setNotification('Error loading existing budget. Check console/logs.');
            return;
        }

        if (existingRows && existingRows.length > 0) {
            // Update existing
            const id = existingRows[0].id;
            const { error: updateError } = await supabase
                .from('category_budgets')
                .update({ amount: numAmount })
                .eq('id', id)
                .eq('user_id', user.id); // Ensure user can only update their own budgets

            if (updateError) {
                console.error(updateError);
                setNotification('Error updating budget. Check console/logs.');
                return;
            }
        } else {
            // Insert new
            const { error: insertError } = await supabase
                .from('category_budgets')
                .insert({
                    category_id: budgetCategoryId,
                    month: monthStr,
                    amount: numAmount,
                    user_id: user.id,
                });

            if (insertError) {
                console.error(insertError);
                setNotification('Error creating budget. Check console/logs.');
                return;
            }
        }

        // Reload budgets for this month
        const { data: budgetsData, error: budgetsError } = await supabase
            .from('category_budgets')
            .select('id, category_id, month, amount')
            .eq('user_id', user.id)
            .eq('month', monthStr);

        if (budgetsError) {
            console.error(budgetsError);
            setNotification('Budget saved, but failed to reload budgets.');
        } else {
            setBudgets(budgetsData || []);
            const catName =
                categories.find(c => c.id === budgetCategoryId)?.name ||
                'This category';
                setNotification(
                    `Budget set for ${catName} in ${monthLabel}: ${new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                    }).format(numAmount)}.`
                );
        }
    };

    // ---- Transaction row CRUD handlers ----

    const handleEditTransaction = (tx: Transaction) => {
        setEditingId(tx.id);
        // date input expects YYYY-MM-DD
        setDate(tx.date.slice(0, 10));
        setAmount(Math.abs(tx.amount).toString());
        setTransactionType(tx.amount >= 0 ? 'income' : 'expense');
        setPerson(tx.person);
        setNote(tx.note ?? '');

        // Prefer stored IDs; fall back to matching by name
        if (tx.accountId) {
            setAccountId(tx.accountId);
        } else if (tx.account) {
            const acc = accounts.find(a => a.name === tx.account);
            setAccountId(acc?.id ?? '');
        } else {
            setAccountId('');
        }

        if (tx.categoryId) {
            setCategoryId(tx.categoryId);
            const cat = categories.find(c => c.id === tx.categoryId);
            setCategoryName(cat?.name || '');
        } else if (tx.category) {
            const cat = categories.find(c => c.name === tx.category);
            setCategoryId(cat?.id ?? '');
            setCategoryName(tx.category);
        } else {
            setCategoryId('');
            setCategoryName('');
        }

        // Open the form when editing
        setShowAddTransaction(true);
    };
    
    const handleBulkSave = async () => {
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setNotification('You must be logged in to save transactions.');
            return;
        }

        const validTransactions = bulkTransactions.filter(tx => 
            tx.date && tx.accountId && tx.amount && (tx.categoryId || tx.categoryName)
        );
        
        if (validTransactions.length === 0) {
            setNotification('Please add at least one valid transaction.');
            return;
        }
        
        setNotification(null);
        
        // Process each transaction, creating categories as needed
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
                person: tx.person,
                note: tx.note || null,
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
        
        await reloadTransactionsForMonth();
        setNotification(`Successfully saved ${transactionsToInsert.length} transaction(s).`);
        setBulkTransactions([{
            date: new Date().toISOString().slice(0, 10),
            accountId: '',
            categoryId: '',
            categoryName: '',
            type: 'expense',
            amount: '',
            person: 'Malik',
            note: '',
        }]);
        setShowBulkTransaction(false);
    };

    const handleCancelEdit = () => {
        resetFormToDefault();
    };

    const handleDeleteTransaction = async (id: string) => {
        setNotification(null);

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setNotification('You must be logged in to delete transactions.');
            return;
        }

        // optional confirm
        if (typeof window !== 'undefined') {
            const ok = window.confirm('Delete this transaction?');
            if (!ok) return;
        }

        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id); // Ensure user can only delete their own transactions

        if (error) {
            console.error(error);
            setNotification('Error deleting transaction. Check console/logs.');
            return;
        }

        await reloadTransactionsForMonth();

        // if we were editing this one, reset the form
        if (editingId === id) {
            resetFormToDefault();
        }

        setNotification('Transaction deleted.');
    };

    const handleDuplicateTransaction = async (tx: Transaction) => {
        setNotification(null);

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setNotification('You must be logged in to duplicate transactions.');
            return;
        }

        // resolve account/category IDs (use stored ids, else match by name)
        let accId: string | null = tx.accountId;
        if (!accId && tx.account) {
            const acc = accounts.find(a => a.name === tx.account);
            accId = acc?.id ?? null;
        }

        let catId: string | null = tx.categoryId;
        if (!catId && tx.category) {
            const cat = categories.find(c => c.name === tx.category);
            catId = cat?.id ?? null;
        }

        if (!accId || !catId) {
            setNotification(
                'Cannot duplicate this transaction: missing account or category.'
            );
            return;
        }

        const { error } = await supabase.from('transactions').insert({
            // keep same date; ensure YYYY-MM-DD format
            date: tx.date.slice(0, 10),
            account_id: accId,
            category_id: catId,
            amount: tx.amount,
            person: tx.person,
            note: tx.note,
            user_id: user.id,
        });

        if (error) {
            console.error(error);
            setNotification('Error duplicating transaction. Check console/logs.');
            return;
        }

        await reloadTransactionsForMonth();
        setNotification('Transaction duplicated.');
    };

    return (
        <section className="space-y-4 px-4 py-4 sm:px-6">
            {notification && (
                <div className="rounded-md border border-amber-500 bg-amber-950 px-4 py-2 text-xs text-amber-100">
                    {notification}
                </div>
            )}
            {/* 🔹 Dashboard Summary - Net Worth, Income, Expenses, Cashflow */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Net Worth */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Net Worth</p>
                    <p
                        className={`text-xl sm:text-2xl font-semibold ${
                            netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                    >
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(netWorth)}
                    </p>
                </div>

                {/* Income */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Income</p>
                    <p className="text-2xl font-semibold text-emerald-400">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(totalIncome)}
                    </p>
                </div>

                {/* Expenses */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Expenses</p>
                    <p className="text-2xl font-semibold text-red-400">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            minimumFractionDigits: 2,
                        }).format(totalExpenses)}
                    </p>
                </div>

                {/* Cashflow */}
                <div className="rounded-lg bg-slate-900 p-4 border border-slate-800">
                    <p className="text-xs uppercase text-slate-400">Cashflow</p>
                    <p
                        className={`text-2xl font-semibold ${
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

            {/* 🔹 Monthly Switcher with Money in, Money out, Net */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <div className="mb-2 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={goToPrevMonth}
                        className="rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-sm hover:bg-slate-800 active:bg-slate-900 transition-colors"
                        aria-label="Previous month"
                    >
                        ◀
                    </button>
                    <div className="text-center">
                        <h2 className="text-sm sm:text-base font-semibold">{monthLabel}</h2>
                        <p className="text-[10px] sm:text-xs text-slate-400">{monthStr}</p>
                    </div>
                    <button
                        type="button"
                        onClick={goToNextMonth}
                        className="rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-sm hover:bg-slate-800 active:bg-slate-900 transition-colors"
                        aria-label="Next month"
                    >
                        ▶
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div>
                        <div className="text-xs sm:text-sm text-slate-400">Money in</div>
                        <div className="mt-1 text-xs sm:text-sm font-semibold text-emerald-400">
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 2,
                            }).format(totalIn)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs sm:text-sm text-slate-400">Money out</div>
                        <div className="mt-1 text-xs sm:text-sm font-semibold text-red-400">
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 2,
                            }).format(Math.abs(totalOut))}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs sm:text-sm text-slate-400">Net</div>
                        <div
                            className={`mt-1 text-xs sm:text-sm font-semibold ${
                                net >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                        >
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 2,
                            }).format(net)}
                        </div>
                    </div>
                </div>
            </div>

            {/* 🔹 Add Transaction - Collapsible */}
            <div className="rounded-lg border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between p-4">
                    <button
                        type="button"
                        onClick={() => {
                            setShowAddTransaction(!showAddTransaction);
                            // If opening and editing, reset form
                            if (!showAddTransaction && editingId) {
                                resetFormToDefault();
                            }
                        }}
                        className="flex-1 flex items-center justify-between text-left hover:bg-slate-800 transition-colors -ml-4 -mr-4 px-4 py-2 rounded"
                    >
                        <h2 className="text-sm font-semibold">
                            {editingId ? 'Edit transaction' : 'Add Transaction'}
                        </h2>
                        <span className="text-xs text-slate-400">
                            {showAddTransaction ? '▼' : '▶'}
                        </span>
                    </button>
                    {!showAddTransaction && !editingId && (
                        <button
                            type="button"
                            onClick={() => setShowBulkTransaction(!showBulkTransaction)}
                            className="ml-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                        >
                            Bulk Add
                        </button>
                    )}
                </div>

                {showAddTransaction && (
                    <div className="border-t border-slate-800 p-4">
                        {editingId && (
                            <div className="mb-2 text-[10px] text-slate-400">
                                Editing existing transaction
                            </div>
                        )}
                        <form
                            className="space-y-3 text-xs"
                            onSubmit={handleAddOrUpdateTransaction}
                        >
                            <div className="space-y-1">
                                <label className="block text-slate-300">Date</label>
                                <input
                                    type="date"
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-slate-300">Account</label>
                                <select
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={accountId}
                                    onChange={e => setAccountId(e.target.value)}
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
                                <label className="block text-slate-300">Type</label>
                                <select
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={transactionType}
                                    onChange={e => {
                                        setTransactionType(e.target.value as 'expense' | 'income');
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
                                <label className="block text-slate-300">Category</label>
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        list={`category-list-${transactionType}`}
                                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                        value={categoryName || (categoryId ? categories.find(c => c.id === categoryId)?.name || '' : '')}
                                        onChange={async (e) => {
                                            const inputValue = e.target.value;
                                            setCategoryName(inputValue);
                                            
                                            // Try to find matching category
                                            const matchingCategory = categories.find(
                                                c => c.name.toLowerCase() === inputValue.toLowerCase() && 
                                                ((transactionType === 'income' && c.type === 'income') || 
                                                 (transactionType === 'expense' && c.type === 'expense'))
                                            );
                                            
                                            if (matchingCategory) {
                                                setCategoryId(matchingCategory.id);
                                            } else {
                                                setCategoryId(''); // Will create new category on save
                                            }
                                        }}
                                        placeholder="Type or select category..."
                                    />
                                    <datalist id={`category-list-${transactionType}`}>
                                        {(() => {
                                            // Organize categories into hierarchy
                                            const groups = categories.filter(c => c.kind === 'group' && 
                                                ((transactionType === 'income' && c.type === 'income') || 
                                                 (transactionType === 'expense' && c.type === 'expense')));
                                            const subcategories = categories.filter(c => c.kind === 'category' && c.parent_id &&
                                                ((transactionType === 'income' && c.type === 'income') || 
                                                 (transactionType === 'expense' && c.type === 'expense')));
                                            const standalone = categories.filter(c => c.kind === 'category' && !c.parent_id &&
                                                ((transactionType === 'income' && c.type === 'income') || 
                                                 (transactionType === 'expense' && c.type === 'expense')));
                                            
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
                                                        {cat.type === 'income' ? '⬆️' : '⬇️'} {cat.name}
                                                    </option>
                                                );
                                            });
                                            
                                            return options;
                                        })()}
                                    </datalist>
                                    <p className="text-[10px] text-slate-500">
                                        Type a category name to create a new one, or select from the list
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-slate-300">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder={transactionType === 'expense' ? '-45.23' : '45.23'}
                                />
                                <p className="text-[10px] text-slate-500">
                                    {transactionType === 'expense' 
                                        ? 'Enter amount as positive number (will be saved as negative)'
                                        : 'Enter amount as positive number'}
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-slate-300">Person</label>
                                <select
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={person}
                                    onChange={e => setPerson(e.target.value)}
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

                            <div className="mt-2 flex gap-2">
                                {!editingId && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleAddOrUpdateTransaction(e, true)}
                                        className="flex-1 rounded-md border border-amber-400 bg-amber-950 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900"
                                    >
                                        Save & Add Another
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className={`${editingId ? 'w-full' : 'flex-1'} rounded-md bg-amber-400 py-2 text-xs font-semibold text-black hover:bg-amber-300`}
                                >
                                    {editingId ? 'Update transaction' : 'Save transaction'}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="w-full rounded-md border border-slate-600 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                                    >
                                        Cancel edit
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                )}
                
                {/* Bulk Transaction Form */}
                {showBulkTransaction && (
                    <div className="border-t border-slate-800 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-xs font-semibold">Bulk Add Transactions</h3>
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
                                        person: 'Malik',
                                        note: '',
                                    }]);
                                    setShowBulkTransaction(false);
                                }}
                                className="text-xs text-slate-400 hover:text-slate-200"
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
                                                list={`bulk-category-list-${index}-${tx.type}`}
                                                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                value={tx.categoryName || (tx.categoryId ? categories.find(c => c.id === tx.categoryId)?.name || '' : '')}
                                                onChange={e => {
                                                    const newTxs = [...bulkTransactions];
                                                    const inputValue = e.target.value;
                                                    newTxs[index].categoryName = inputValue;
                                                    
                                                    // Try to find matching category
                                                    const matchingCategory = categories.find(
                                                        c => c.name.toLowerCase() === inputValue.toLowerCase() && c.type === tx.type
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
                                            <datalist id={`bulk-category-list-${index}-${tx.type}`}>
                                                {(() => {
                                                    // Organize categories into hierarchy
                                                    const groups = categories.filter(c => c.kind === 'group' && c.type === tx.type);
                                                    const subcategories = categories.filter(c => c.kind === 'category' && c.parent_id && c.type === tx.type);
                                                    const standalone = categories.filter(c => c.kind === 'category' && !c.parent_id && c.type === tx.type);
                                                    
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
                                    <div className="grid grid-cols-2 gap-2">
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
                                            <label className="block text-[10px] text-slate-400 mb-1">Person</label>
                                            <select
                                                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                                                value={tx.person}
                                                onChange={e => {
                                                    const newTxs = [...bulkTransactions];
                                                    newTxs[index].person = e.target.value;
                                                    setBulkTransactions(newTxs);
                                                }}
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
                                        person: bulkTransactions[0]?.person || 'Malik',
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
                                Save All ({bulkTransactions.filter(tx => tx.date && tx.accountId && tx.categoryId && tx.amount).length})
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 🔹 Recent Transactions */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h2 className="mb-2 text-sm font-semibold">
                    Recent transactions
                </h2>
                {loading ? (
                    <p className="text-slate-400">Loading...</p>
                ) : transactions.length === 0 ? (
                    <p className="text-slate-400">
                        No transactions yet. Add your first one above.
                    </p>
                ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                        {transactions.slice(0, 5).map(tx => (
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
                                        {tx.amount >= 0 ? '+' : '-'}
                                        {new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: 'USD',
                                            minimumFractionDigits: 2,
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
                                            onClick={() =>
                                                handleDuplicateTransaction(tx)
                                            }
                                            className="hover:text-amber-200"
                                        >
                                            Duplicate
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleDeleteTransaction(tx.id)
                                            }
                                            className="hover:text-red-400"
                                        >
                                            Delete
                                        </button>
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
