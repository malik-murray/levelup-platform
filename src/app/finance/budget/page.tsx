'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';

type Category = {
    id: string;
    name: string;
    type: 'income' | 'expense' | string;
};

type SubCategory = {
    id: string;
    name: string;
    category_id: string; // Links to parent category
    type: 'income' | 'expense' | string;
};

type CategoryBudget = {
    id: string;
    category_id: string;
    month: string;
    amount: number;
};

type Transaction = {
    id: string;
    date: string;
    amount: number;
    categoryId: string | null;
};

type TxRow = {
    id: string;
    date: string;
    amount: number;
    category_id: string | null;
};

export default function BudgetPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [budgetCategoryId, setBudgetCategoryId] = useState<string>('');
    const [budgetAmount, setBudgetAmount] = useState<string>('');
    const [notification, setNotification] = useState<string | null>(null);
    const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
    const [editingBudgetAmount, setEditingBudgetAmount] = useState<string>('');
    
    // Category creation state
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
    const [newCategoryParentId, setNewCategoryParentId] = useState<string>('');
    const [creatingCategory, setCreatingCategory] = useState(false);
    const [isCreatingSubCategory, setIsCreatingSubCategory] = useState(false);
    
    // Track which parent categories are expanded
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
    
    const toggleParent = (parentId: string) => {
        setExpandedParents(prev => {
            const next = new Set(prev);
            if (next.has(parentId)) {
                next.delete(parentId);
            } else {
                next.add(parentId);
            }
            return next;
        });
    };

    const [monthDate, setMonthDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const monthStr = useMemo(
        () =>
            `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(
                2,
                '0',
            )}`,
        [monthDate],
    );

    const monthLabel = useMemo(
        () =>
            monthDate.toLocaleString('default', {
                month: 'long',
                year: 'numeric',
            }),
        [monthDate],
    );

    const goToPrevMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
        );
    };

    const goToNextMonth = () => {
        setMonthDate(
            prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
        );
    };

    // Load categories, budgets, and transactions for selected month
    useEffect(() => {
        const load = async () => {
            setLoading(true);

            const startOfMonth = new Date(
                monthDate.getFullYear(),
                monthDate.getMonth(),
                1,
            );
            const endOfMonth = new Date(
                monthDate.getFullYear(),
                monthDate.getMonth() + 1,
                1,
            );

            const startStr = startOfMonth.toISOString().slice(0, 10);
            const endStr = endOfMonth.toISOString().slice(0, 10);

            // Fetch categories and sub_categories separately
            const [
                { data: categoriesData, error: categoriesError },
                { data: subCategoriesData, error: subCategoriesError },
            ] = await Promise.all([
                supabase.from('categories').select('id, name, type'),
                supabase.from('sub_categories').select('id, name, type, category_id'),
            ]);

            const [
                { data: budgetsData, error: budgetsError },
                { data: txData, error: txError },
            ] = await Promise.all([
                supabase
                    .from('category_budgets')
                    .select('id, category_id, month, amount')
                    .eq('month', monthStr),
                supabase
                    .from('transactions')
                    .select('id, date, amount, category_id')
                    .gte('date', startStr)
                    .lt('date', endStr)
                    .order('date', { ascending: false }),
            ]);

            if (categoriesError) console.error('categoriesError', categoriesError);
            if (subCategoriesError) console.error('subCategoriesError', subCategoriesError);
            if (budgetsError) console.error('budgetsError', budgetsError);
            if (txError) console.error('txError', txError);

            setCategories((categoriesData as Category[]) ?? []);
            setSubCategories((subCategoriesData as SubCategory[]) ?? []);
            setBudgets((budgetsData as CategoryBudget[]) ?? []);

            const mapped: Transaction[] =
                ((txData as TxRow[] | null) ?? []).map(row => ({
                    id: row.id,
                    date: row.date,
                    amount: Number(row.amount),
                    categoryId: row.category_id,
                }));

            setTransactions(mapped);
            setLoading(false);
        };

        load().catch(err => {
            console.error('Budget load failed', err);
            setLoading(false);
        });
    }, [monthDate, monthStr]);

    // Budgets can be set on both categories and subcategories
    // The category_id in category_budgets can point to either
    const budgetsByCategoryId = useMemo(() => {
        const map = new Map<string, CategoryBudget>();
        budgets.forEach(b => {
            map.set(b.category_id, b);
        });
        return map;
    }, [budgets]);
    
    // Create a combined list of all categories and subcategories for budget assignment
    const allBudgetableItems = useMemo(() => {
        const items: Array<{ id: string; name: string; type: string; isSubCategory: boolean }> = [];
        categories.forEach(cat => {
            items.push({ id: cat.id, name: cat.name, type: cat.type, isSubCategory: false });
        });
        subCategories.forEach(sub => {
            items.push({ id: sub.id, name: sub.name, type: sub.type, isSubCategory: true });
        });
        return items;
    }, [categories, subCategories]);

    const spendingByCategoryId = useMemo(() => {
        const map = new Map<string, number>();
        transactions.forEach(tx => {
            if (!tx.categoryId) return;
            if (tx.amount >= 0) return; // only expenses
            const prev = map.get(tx.categoryId) || 0;
            map.set(tx.categoryId, prev + Math.abs(tx.amount));
        });
        return map;
    }, [transactions]);

    // Helper to get category name (from either categories or sub_categories)
    const getCategoryName = (id: string): string => {
        const category = categories.find(c => c.id === id);
        if (category) return category.name;
        const subCategory = subCategories.find(s => s.id === id);
        if (subCategory) return subCategory.name;
        return 'Unknown';
    };

    const handleSaveBudget = async (e: FormEvent) => {
        e.preventDefault();

        if (!budgetCategoryId) return;

        const numAmount = Number(budgetAmount);
        if (Number.isNaN(numAmount)) return;

        setNotification(null);

        // Check if a budget already exists for this category + month
        const { data: existingRows, error: fetchError } = await supabase
            .from('category_budgets')
            .select('id, amount')
            .eq('category_id', budgetCategoryId)
            .eq('month', monthStr)
            .limit(1);

        if (fetchError) {
            console.error(fetchError);
            setNotification('Error saving budget. Check console/logs.');
            return;
        }

        if (existingRows && existingRows.length > 0) {
            // Update
            const id = existingRows[0].id;
            const { error: updateError } = await supabase
                .from('category_budgets')
                .update({ amount: numAmount })
                .eq('id', id);

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
            .eq('month', monthStr);

        if (budgetsError) {
            console.error(budgetsError);
            setNotification('Error reloading budgets. Check console/logs.');
        } else {
            setBudgets((budgetsData as CategoryBudget[]) ?? []);

            const catName = getCategoryName(budgetCategoryId);
            setNotification(
                `Budget set for ${catName} in ${monthLabel}: $${numAmount.toFixed(2)}.`,
            );
            
            // Reset form
            setBudgetCategoryId('');
            setBudgetAmount('');
        }
    };

    const handleStartEditBudget = (categoryId: string) => {
        const existing = budgetsByCategoryId.get(categoryId);
        if (existing) {
            setEditingBudgetId(categoryId);
            setEditingBudgetAmount(existing.amount.toString());
        }
    };

    const handleCancelEditBudget = () => {
        setEditingBudgetId(null);
        setEditingBudgetAmount('');
    };

    const handleSaveEditBudget = async (categoryId: string) => {
        const numAmount = parseFloat(editingBudgetAmount);
        if (Number.isNaN(numAmount) || numAmount < 0) {
            setNotification('Please enter a valid budget amount.');
            return;
        }

        setNotification(null);

        const { data: existingRows, error: fetchError } = await supabase
            .from('category_budgets')
            .select('id, amount')
            .eq('category_id', categoryId)
            .eq('month', monthStr)
            .limit(1);

        if (fetchError) {
            console.error(fetchError);
            setNotification('Error updating budget. Check console/logs.');
            return;
        }

        if (existingRows && existingRows.length > 0) {
            const id = existingRows[0].id;
            const { error: updateError } = await supabase
                .from('category_budgets')
                .update({ amount: numAmount })
                .eq('id', id);

            if (updateError) {
                console.error(updateError);
                setNotification('Error updating budget. Check console/logs.');
                return;
            }
        } else {
            // Insert new if doesn't exist
            const { error: insertError } = await supabase
                .from('category_budgets')
                .insert({
                    category_id: categoryId,
                    month: monthStr,
                    amount: numAmount,
                });

            if (insertError) {
                console.error(insertError);
                setNotification('Error creating budget. Check console/logs.');
                return;
            }
        }

        // Reload budgets
        const { data: budgetsData, error: budgetsError } = await supabase
            .from('category_budgets')
            .select('id, category_id, month, amount')
            .eq('month', monthStr);

        if (budgetsError) {
            console.error(budgetsError);
            setNotification('Error reloading budgets. Check console/logs.');
        } else {
            setBudgets((budgetsData as CategoryBudget[]) ?? []);
            const catName = getCategoryName(categoryId);
            setNotification(`Budget updated for ${catName}: $${numAmount.toFixed(2)}.`);
        }

        setEditingBudgetId(null);
        setEditingBudgetAmount('');
    };

    const handleDeleteBudget = async (categoryId: string) => {
        if (!confirm('Are you sure you want to delete this budget?')) {
            return;
        }

        const { data: existingRows, error: fetchError } = await supabase
            .from('category_budgets')
            .select('id')
            .eq('category_id', categoryId)
            .eq('month', monthStr)
            .limit(1);

        if (fetchError) {
            console.error(fetchError);
            setNotification('Error deleting budget. Check console/logs.');
            return;
        }

        if (existingRows && existingRows.length > 0) {
            const { error: deleteError } = await supabase
                .from('category_budgets')
                .delete()
                .eq('id', existingRows[0].id);

            if (deleteError) {
                console.error(deleteError);
                setNotification('Error deleting budget. Check console/logs.');
                return;
            }

            // Reload budgets
            const { data: budgetsData, error: budgetsError } = await supabase
                .from('category_budgets')
                .select('id, category_id, month, amount')
                .eq('month', monthStr);

            if (budgetsError) {
                console.error(budgetsError);
                setNotification('Error reloading budgets. Check console/logs.');
            } else {
                setBudgets((budgetsData as CategoryBudget[]) ?? []);
                const catName = getCategoryName(categoryId);
                setNotification(`Budget deleted for ${catName}.`);
            }
        }
    };

    const handleCreateCategory = async (e: FormEvent) => {
        e.preventDefault();

        if (!newCategoryName.trim()) {
            setNotification('Category name is required.');
            return;
        }

        setCreatingCategory(true);
        setNotification(null);

        try {
            // Build insert object - only include parent_id if a parent is selected
            const insertData: any = {
                name: newCategoryName.trim(),
                type: newCategoryType,
            };
            
            // Try to insert with parent_id if provided
            if (newCategoryParentId) {
                insertData.parent_id = newCategoryParentId;
            }
            
            let result = await supabase.from('categories').insert(insertData);
            
            // If insert fails and parent_id was included, try without it
            if (result.error && newCategoryParentId) {
                console.log('Insert with parent_id failed, trying without parent_id. Column may not exist.');
                console.log('Error details:', JSON.stringify(result.error, null, 2));
                
                const insertWithoutParent = {
                    name: newCategoryName.trim(),
                    type: newCategoryType,
                };
                result = await supabase.from('categories').insert(insertWithoutParent);
                
                if (result.error) {
                    console.error('Category creation error (without parent_id):', result.error);
                    setNotification(
                        `Error creating category: ${result.error.message || JSON.stringify(result.error)}`
                    );
                    return;
                } else {
                    setNotification(
                        `Category "${newCategoryName.trim()}" created successfully. ` +
                        `Note: To enable subcategories, add a 'parent_id' column (UUID, nullable) to the categories table.`
                    );
                }
            } else if (result.error) {
                console.error('Category creation error:', result.error);
                const errorMsg = result.error.message || JSON.stringify(result.error) || 'Unknown error';
                setNotification(`Error creating category: ${errorMsg}`);
                return;
            } else {
                setNotification(`Category "${newCategoryName.trim()}" created successfully.`);
            }

            // Reset form
            setNewCategoryName('');
            setNewCategoryType('expense');
            setNewCategoryParentId('');
            setShowAddCategory(false);

            // Reload categories and sub_categories
            const [
                { data: reloadCategoriesData, error: reloadCategoriesError },
                { data: reloadSubCategoriesData, error: reloadSubCategoriesError },
            ] = await Promise.all([
                supabase.from('categories').select('id, name, type'),
                supabase.from('sub_categories').select('id, name, type, category_id'),
            ]);

            if (reloadCategoriesError) {
                console.error('categoriesError', reloadCategoriesError);
            } else {
                setCategories((reloadCategoriesData as Category[]) ?? []);
            }

            if (reloadSubCategoriesError) {
                console.error('subCategoriesError', reloadSubCategoriesError);
            } else {
                setSubCategories((reloadSubCategoriesData as SubCategory[]) ?? []);
            }
        } catch (err) {
            console.error('Category creation failed:', err);
            setNotification('Error creating category. Check console/logs.');
        } finally {
            setCreatingCategory(false);
        }
    };

    // Organize categories into parent/child structure using sub_categories table
    const categoriesByParent = useMemo(() => {
        const parents = categories;
        const map = new Map<string, SubCategory[]>();
        
        // Group subcategories by their parent category_id
        subCategories.forEach(sub => {
            const siblings = map.get(sub.category_id) || [];
            siblings.push(sub);
            map.set(sub.category_id, siblings);
        });
        
        return { parents, childrenMap: map };
    }, [categories, subCategories]);

    return (
        <section className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Budget</h2>
                    <p className="text-xs text-slate-400">
                        Plan how every dollar will be used this month.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                    <button
                        type="button"
                        onClick={goToPrevMonth}
                        className="rounded-full border border-slate-700 px-2 py-1 hover:bg-slate-800"
                    >
                        ◀
                    </button>
                    <span>{monthLabel}</span>
                    <button
                        type="button"
                        onClick={goToNextMonth}
                        className="rounded-full border border-slate-700 px-2 py-1 hover:bg-slate-800"
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

            {/* Add Category Section */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Categories</h3>
                    <button
                        type="button"
                        onClick={() => setShowAddCategory(!showAddCategory)}
                        className="rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-300"
                    >
                        {showAddCategory ? 'Cancel' : '+ Add Category/Sub-Category'}
                    </button>
                </div>

                {showAddCategory && (
                    <form onSubmit={handleCreateCategory} className="mb-4 space-y-3 rounded-md bg-slate-950 p-3">
                        <div>
                            <label className="block text-slate-300 mb-1">Category Name</label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                placeholder="e.g., Groceries, Rent, Salary"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-slate-300 mb-1">Type</label>
                            <select
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                                value={newCategoryType}
                                onChange={e => setNewCategoryType(e.target.value as 'income' | 'expense')}
                            >
                                <option value="expense">⬇️ Expense</option>
                                <option value="income">⬆️ Income</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-slate-300 mb-1">Parent Category (Optional)</label>
                            <select
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                                value={newCategoryParentId}
                                onChange={e => setNewCategoryParentId(e.target.value)}
                            >
                                <option value="">None (Top-level category)</option>
                                {categoriesByParent.parents
                                    .filter(c => c.type === newCategoryType)
                                    .map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.type === 'income' ? '⬆️' : '⬇️'} {c.name}
                                        </option>
                                    ))}
                            </select>
                            <p className="mt-1 text-[10px] text-slate-400">
                                {newCategoryParentId 
                                    ? 'This will create a subcategory linked to the selected parent category.'
                                    : 'Select a parent category to create a subcategory instead of a top-level category'}
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={creatingCategory}
                            className="w-full rounded-md bg-amber-400 px-3 py-2 text-[11px] font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                        >
                            {creatingCategory ? 'Creating...' : 'Create Category'}
                        </button>
                    </form>
                )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-2 text-sm font-semibold">Budgets this month</h3>

                {/* Budget editor */}
                <form
                    onSubmit={handleSaveBudget}
                    className="mb-3 flex flex-col gap-2 text-[11px] md:flex-row md:items-end"
                >
                    <div className="flex-1 space-y-1">
                        <label className="block text-slate-300">Category</label>
                        <select
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                            value={budgetCategoryId}
                            onChange={e => {
                                const nextId = e.target.value;
                                setBudgetCategoryId(nextId);

                                if (!nextId) {
                                    setBudgetAmount('');
                                    return;
                                }

                                const existing = budgetsByCategoryId.get(nextId);
                                if (existing) {
                                    setBudgetAmount(existing.amount.toString());
                                } else {
                                    setBudgetAmount('');
                                }
                            }}
                        >
                            <option value="">Select category</option>
                            {categoriesByParent.parents.map(parent => {
                                const subcategories = categoriesByParent.childrenMap.get(parent.id) || [];
                                return (
                                    <optgroup key={parent.id} label={`${parent.type === 'income' ? '⬆️' : '⬇️'} ${parent.name}`}>
                                        <option value={parent.id}>
                                            {parent.name} {subcategories.length > 0 ? '(All)' : ''}
                                        </option>
                                        {subcategories.map(sub => (
                                            <option key={sub.id} value={sub.id}>
                                                &nbsp;&nbsp;└ {sub.name}
                                </option>
                            ))}
                                    </optgroup>
                                );
                            })}
                        </select>
                    </div>

                    <div className="w-28 space-y-1">
                        <label className="block text-slate-300">Amount</label>
                        <input
                            type="number"
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                            value={budgetAmount}
                            onChange={e => setBudgetAmount(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="rounded-md bg-amber-400 px-3 py-2 text-[11px] font-semibold text-black hover:bg-amber-300"
                    >
                        Save budget
                    </button>
                </form>

                {/* Budget list */}
                {loading ? (
                    <div className="text-[11px] text-slate-400">Loading budgets…</div>
                ) : (
                    <div className="space-y-2">
                        {categoriesByParent.parents.map(parent => {
                            const subcategories = categoriesByParent.childrenMap.get(parent.id) || [];
                            const isExpanded = expandedParents.has(parent.id);
                            const hasSubcategories = subcategories.length > 0;
                            
                            // Calculate parent budget as sum of subcategory budgets (not parent's own budget)
                            let totalBudget = 0;
                            let totalSpent = 0;
                            
                            subcategories.forEach(sub => {
                                const subBudget = budgetsByCategoryId.get(sub.id);
                                const subSpent = spendingByCategoryId.get(sub.id) || 0;
                                totalBudget += subBudget?.amount ?? 0;
                                totalSpent += subSpent;
                            });
                            
                            // If no subcategories, use parent's own budget
                            if (!hasSubcategories) {
                                const parentBudget = budgetsByCategoryId.get(parent.id);
                                const parentSpent = spendingByCategoryId.get(parent.id) || 0;
                                totalBudget = parentBudget?.amount ?? 0;
                                totalSpent = parentSpent;
                            }
                            
                            const remaining = totalBudget - totalSpent;
                            const pct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
                            const barColorClass =
                                remaining < 0
                                    ? 'bg-red-500'
                                    : pct > 90
                                        ? 'bg-yellow-400'
                                        : 'bg-emerald-500';

                            const parentBudget = budgetsByCategoryId.get(parent.id);
                            const isEditingParent = editingBudgetId === parent.id;

                            return (
                                <div key={parent.id} className="space-y-1">
                                    <div className="rounded-md bg-slate-950 p-2 shadow-sm shadow-slate-900">
                                        <div className="flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() => hasSubcategories && toggleParent(parent.id)}
                                                className={`flex items-center gap-2 font-medium text-slate-100 hover:text-amber-400 transition-colors ${
                                                    hasSubcategories ? 'cursor-pointer' : 'cursor-default'
                                                }`}
                                            >
                                                {hasSubcategories && (
                                                    <span className="text-xs">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>
                                                )}
                                                <span>
                                                    {parent.type === 'income' ? '⬆️' : '⬇️'} {parent.name}
                                                    {hasSubcategories && (
                                                        <span className="ml-2 text-[10px] text-slate-400">
                                                            ({subcategories.length} subcategor{subcategories.length !== 1 ? 'ies' : 'y'})
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                            <div className="flex items-center gap-2">
                                                {isEditingParent ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-24 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] text-right"
                                                            value={editingBudgetAmount}
                                                            onChange={e => setEditingBudgetAmount(e.target.value)}
                                                            autoFocus
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    handleSaveEditBudget(parent.id);
                                                                } else if (e.key === 'Escape') {
                                                                    handleCancelEditBudget();
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSaveEditBudget(parent.id)}
                                                            className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] hover:bg-emerald-500"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleCancelEditBudget}
                                                            className="rounded bg-slate-700 px-2 py-0.5 text-[10px] hover:bg-slate-600"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                        <div className="text-[11px] text-slate-300">
                                                            Spent ${totalSpent.toFixed(2)} / Budget ${totalBudget.toFixed(2)}
                                                        </div>
                                                        {parentBudget && (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEditBudget(parent.id)}
                                                                    className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] hover:bg-slate-600"
                                                                    title="Edit budget"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteBudget(parent.id)}
                                                                    className="rounded bg-red-900 px-1.5 py-0.5 text-[10px] hover:bg-red-800"
                                                                    title="Delete budget"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                    </div>
                                    <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                                        <div
                                            className={`h-1.5 rounded-full ${barColorClass}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                        <div className="mt-1 flex items-center justify-between">
                                            <div className="text-[11px] text-slate-400">
                                        Remaining: ${remaining.toFixed(2)}
                                            </div>
                                            {!parentBudget && !isEditingParent && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEditBudget(parent.id)}
                                                    className="text-[10px] text-amber-400 hover:text-amber-300"
                                                >
                                                    + Set budget
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Subcategories - only show when expanded */}
                                    {hasSubcategories && isExpanded && (
                                        <div className="ml-4 space-y-1 border-l-2 border-slate-700 pl-3">
                                            {subcategories.map(sub => {
                                                const subBudget = budgetsByCategoryId.get(sub.id);
                                                const subSpent = spendingByCategoryId.get(sub.id) || 0;
                                                const subBudgetAmount = subBudget?.amount ?? 0;
                                                const subRemaining = subBudgetAmount - subSpent;
                                                const subPct = subBudgetAmount > 0 ? Math.min(100, (subSpent / subBudgetAmount) * 100) : 0;
                                                const subBarColorClass =
                                                    subRemaining < 0
                                                        ? 'bg-red-500'
                                                        : subPct > 90
                                                            ? 'bg-yellow-400'
                                                            : 'bg-emerald-500';
                                                const isEditingSub = editingBudgetId === sub.id;
                                                
                                                return (
                                                    <div
                                                        key={sub.id}
                                                        className="rounded-md bg-slate-900 p-2 shadow-sm"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-sm text-slate-200">
                                                                └ {sub.name}
                                                            </div>
                                                            {isEditingSub ? (
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] text-right"
                                                                        value={editingBudgetAmount}
                                                                        onChange={e => setEditingBudgetAmount(e.target.value)}
                                                                        autoFocus
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') {
                                                                                handleSaveEditBudget(sub.id);
                                                                            } else if (e.key === 'Escape') {
                                                                                handleCancelEditBudget();
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSaveEditBudget(sub.id)}
                                                                        className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] hover:bg-emerald-500"
                                                                    >
                                                                        ✓
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleCancelEditBudget}
                                                                        className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] hover:bg-slate-600"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    <div className="text-[10px] text-slate-400">
                                                                        ${subSpent.toFixed(2)} / ${subBudgetAmount.toFixed(2)}
                                                                    </div>
                                                                    {subBudget && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleStartEditBudget(sub.id)}
                                                                                className="rounded bg-slate-700 px-1 py-0.5 text-[9px] hover:bg-slate-600"
                                                                                title="Edit budget"
                                                                            >
                                                                                ✏️
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteBudget(sub.id)}
                                                                                className="rounded bg-red-900 px-1 py-0.5 text-[9px] hover:bg-red-800"
                                                                                title="Delete budget"
                                                                            >
                                                                                🗑️
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 h-1 rounded-full bg-slate-800">
                                                            <div
                                                                className={`h-1 rounded-full ${subBarColorClass}`}
                                                                style={{ width: `${subPct}%` }}
                                                            />
                                                        </div>
                                                        <div className="mt-1 flex items-center justify-between">
                                                            <div className="text-[10px] text-slate-500">
                                                                Remaining: ${subRemaining.toFixed(2)}
                                                            </div>
                                                            {!subBudget && !isEditingSub && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEditBudget(sub.id)}
                                                                    className="text-[9px] text-amber-400 hover:text-amber-300"
                                                                >
                                                                    + Set budget
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
