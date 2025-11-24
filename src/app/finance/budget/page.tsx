'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';
import { getBudgetGroupsForMonth, getBudgetSummaryForMonth, saveCategoryBudget, deleteCategoryBudget, duplicateBudgets, getNextMonthStr, reorderCategories } from '@/lib/budgetGroups';
import type { BudgetGroup, Category, BudgetSummary } from '@/lib/types';

export default function BudgetPage() {
    const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>([]);
    const [summary, setSummary] = useState<BudgetSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    
    // Category creation state
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
    const [newCategoryParentId, setNewCategoryParentId] = useState<string>('');
    const [newCategoryKind, setNewCategoryKind] = useState<'group' | 'category'>('category');
    const [creatingCategory, setCreatingCategory] = useState(false);
    
    // Track collapsed groups (keyed by group id)
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    
    // Track editing state for budgets (categoryId -> value string)
    const [editingBudgets, setEditingBudgets] = useState<Record<string, string>>({});
    
    // Edit mode state
    const [editMode, setEditMode] = useState(false);
    
    // Track editing state for category names (categoryId -> value string)
    const [editingCategoryNames, setEditingCategoryNames] = useState<Record<string, string>>({});
    
    // Budget duplication state
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateTargetMonth, setDuplicateTargetMonth] = useState<string>('');
    const [duplicating, setDuplicating] = useState(false);

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

    // Load budget groups and summary
    const loadBudgetData = async () => {
        setLoading(true);
        try {
            const [groups, summaryData] = await Promise.all([
                getBudgetGroupsForMonth(monthStr),
                getBudgetSummaryForMonth(monthStr),
            ]);
            setBudgetGroups(groups);
            setSummary(summaryData);
        } catch (error) {
            console.error('Error loading budget data:', error);
            setNotification(
                error instanceof Error ? error.message : 'Failed to load budget data'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBudgetData();
    }, [monthStr]);

    // Fetch all categories for the category creation form
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    useEffect(() => {
        const loadCategories = async () => {
            const { data, error } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .order('name');
            
            if (error) {
                console.error('Error loading categories:', error);
            } else {
                setAllCategories((data as Category[]) ?? []);
            }
        };
        loadCategories();
    }, []);

    const toggleGroup = (groupId: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId],
        }));
    };

    const handleStartEditBudget = (categoryId: string) => {
        const group = budgetGroups.find(g => 
            g.categories.some(c => c.id === categoryId)
        );
        const category = group?.categories.find(c => c.id === categoryId);
        if (category) {
            setEditingBudgets(prev => ({
                ...prev,
                [categoryId]: category.assigned.toString(),
            }));
        }
    };

    const handleCancelEditBudget = (categoryId: string) => {
        setEditingBudgets(prev => {
            const next = { ...prev };
            delete next[categoryId];
            return next;
        });
    };

    const handleSaveBudget = async (categoryId: string, silent: boolean = false) => {
        const valueStr = editingBudgets[categoryId];
        if (valueStr === undefined) return;

        // Find the category to determine its type
        let categoryType: 'income' | 'expense' | null = null;
        for (const group of budgetGroups) {
            const cat = group.categories.find(c => c.id === categoryId);
            if (cat) {
                categoryType = group.type === 'income' ? 'income' : 'expense';
                break;
            }
        }

        // Allow empty string (will be treated as 0)
        const numAmount = valueStr === '' ? 0 : parseFloat(valueStr);
        if (Number.isNaN(numAmount)) {
            if (!silent) {
                setNotification('Please enter a valid budget amount.');
            }
            handleCancelEditBudget(categoryId);
            return;
        }

        // For expenses, allow negative values (or positive, we'll convert)
        // For income, allow positive values (or negative, we'll convert)
        // Actually, let's allow the user to enter negative for expenses and positive for income
        // But ensure expenses are stored as negative and income as positive
        let finalAmount = numAmount;
        if (numAmount !== 0) {
            if (categoryType === 'expense') {
                // Expenses should be negative
                finalAmount = Math.abs(numAmount) * -1;
            } else if (categoryType === 'income') {
                // Income should be positive
                finalAmount = Math.abs(numAmount);
            } else {
                // Default behavior: use as-is (could be either)
                finalAmount = numAmount;
            }
        }

        if (!silent) {
            setNotification(null);
        }

        try {
            // Update local state immediately for instant feedback
            setBudgetGroups(prevGroups => {
                const updatedGroups = prevGroups.map(group => {
                    const categoryIndex = group.categories.findIndex(c => c.id === categoryId);
                    if (categoryIndex === -1) return group;

                    const updatedCategories = [...group.categories];
                    const category = updatedCategories[categoryIndex];
                    
                    const newAssigned = finalAmount;
                    // Calculate available correctly based on category type
                    // For expenses: assigned is negative, but available = |assigned| - activity
                    // For income: assigned is positive, available = assigned - activity
                    let newAvailable: number;
                    if (group.type === 'expense') {
                        // For expenses: use absolute value of assigned
                        newAvailable = Math.abs(newAssigned) - category.activity;
                    } else if (group.type === 'income') {
                        // For income: assigned is positive
                        newAvailable = newAssigned - category.activity;
                    } else {
                        // For transfers or unknown
                        newAvailable = Math.abs(newAssigned) - category.activity;
                    }
                    
                    updatedCategories[categoryIndex] = {
                        ...category,
                        assigned: newAssigned,
                        available: newAvailable,
                    };

                    // Recalculate group totals
                    // For expenses, assigned is negative but we sum absolute values for display
                    // For income, assigned is positive
                    const totalAssigned = updatedCategories.reduce((sum, c) => {
                        if (group.type === 'expense') {
                            return sum + Math.abs(c.assigned);
                        } else {
                            return sum + c.assigned;
                        }
                    }, 0);
                    const totalActivity = updatedCategories.reduce((sum, c) => sum + c.activity, 0);
                    // For available, use the same logic as individual categories
                    const totalAvailable = group.type === 'expense' 
                        ? totalAssigned - totalActivity  // Already using absolute values
                        : totalAssigned - totalActivity;

                    return {
                        ...group,
                        categories: updatedCategories,
                        totalAssigned,
                        totalActivity,
                        totalAvailable,
                    };
                });
                
                // Recalculate summary from updated groups
                const totalAssigned = updatedGroups.reduce((sum, group) => sum + group.totalAssigned, 0);
                const totalActivity = updatedGroups.reduce((sum, group) => sum + group.totalActivity, 0);
                const totalAvailable = totalAssigned - totalActivity;
                
                setSummary({
                    totalAssigned,
                    totalActivity,
                    totalAvailable,
                });
                
                return updatedGroups;
            });

            // Save to database in background (don't await to avoid blocking)
            (async () => {
                try {
                    if (finalAmount === 0) {
                        await deleteCategoryBudget(categoryId, monthStr);
                    } else {
                        await saveCategoryBudget(categoryId, monthStr, finalAmount);
                    }
                } catch (error) {
                    console.error('Error saving budget to database:', error);
                    // Revert local state on error
                    await loadBudgetData();
                    if (!silent) {
                        setNotification(
                            error instanceof Error ? error.message : 'Failed to save budget'
                        );
                    }
                }
            })();

            // Clear editing state
            handleCancelEditBudget(categoryId);
            
            // Only show notification if not silent
            if (!silent && finalAmount !== 0) {
                // Don't show notification for every edit
            }
        } catch (error) {
            console.error('Error saving budget:', error);
            if (!silent) {
                setNotification(
                    error instanceof Error ? error.message : 'Failed to save budget'
                );
            }
        }
    };

    const handleDeleteBudget = async (categoryId: string) => {
        if (!confirm('Are you sure you want to delete this budget?')) {
            return;
        }

        try {
            await deleteCategoryBudget(categoryId, monthStr);
            // Reload budget data
            await loadBudgetData();
            setNotification('Budget deleted successfully.');
        } catch (error) {
            console.error('Error deleting budget:', error);
            setNotification(
                error instanceof Error ? error.message : 'Failed to delete budget'
            );
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
            // Determine parent_id and kind
            const kind = newCategoryKind === 'group' ? 'group' : 'category';
            const parentId = kind === 'category' && newCategoryParentId 
                ? newCategoryParentId 
                : null;

            const { error } = await supabase
                .from('categories')
                .insert({
                    name: newCategoryName.trim(),
                    type: newCategoryType,
                    kind,
                    parent_id: parentId,
                });

            if (error) {
                throw new Error(error.message);
            }

            setNotification(`Category "${newCategoryName.trim()}" created successfully.`);

            // Reset form
            setNewCategoryName('');
            setNewCategoryType('expense');
            setNewCategoryParentId('');
            setNewCategoryKind('category');
            setShowAddCategory(false);

            // Reload categories and budget data
            const { data: categoriesData } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .order('name');
            
            setAllCategories((categoriesData as Category[]) ?? []);
            await loadBudgetData();
        } catch (error) {
            console.error('Category creation failed:', error);
            setNotification(
                error instanceof Error 
                    ? `Error creating category: ${error.message}` 
                    : 'Error creating category. Check console/logs.'
            );
        } finally {
            setCreatingCategory(false);
        }
    };

    // Get group categories for the parent selector
    const groupCategories = useMemo(() => 
        allCategories.filter(c => c.kind === 'group' && c.type === newCategoryType),
        [allCategories, newCategoryType]
    );

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(amount);
    };

    // Generate available months for duplication (next 12 months, excluding current)
    const getAvailableMonths = () => {
        const months: string[] = [];
        const current = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        for (let i = 1; i <= 12; i++) {
            const date = new Date(current.getFullYear(), current.getMonth() + i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.push(monthStr);
        }
        return months;
    };

    const handleUpdateCategoryName = async (categoryId: string, newName: string) => {
        if (!newName.trim()) {
            setNotification('Category name cannot be empty.');
            return;
        }

        setNotification(null);

        try {
            const { error } = await supabase
                .from('categories')
                .update({ name: newName.trim() })
                .eq('id', categoryId);

            if (error) {
                throw new Error(error.message);
            }

            // Reload categories and budget data
            const { data: categoriesData } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .order('name');
            
            setAllCategories((categoriesData as Category[]) ?? []);
            await loadBudgetData();

            // Clear editing state
            setEditingCategoryNames(prev => {
                const next = { ...prev };
                delete next[categoryId];
                return next;
            });

            setNotification('Category name updated successfully.');
        } catch (error) {
            console.error('Error updating category name:', error);
            setNotification(
                error instanceof Error ? error.message : 'Failed to update category name'
            );
        }
    };

    const handleStartEditCategoryName = (categoryId: string, currentName: string) => {
        setEditingCategoryNames(prev => ({
            ...prev,
            [categoryId]: currentName,
        }));
    };

    const handleCancelEditCategoryName = (categoryId: string) => {
        setEditingCategoryNames(prev => {
            const next = { ...prev };
            delete next[categoryId];
            return next;
        });
    };

    // Reorder groups functions
    const handleMoveGroupUp = async (groupId: string) => {
        const currentIndex = budgetGroups.findIndex(g => g.id === groupId);
        if (currentIndex <= 0) return; // Already at top

        // Swap with previous group
        const newGroups = [...budgetGroups];
        [newGroups[currentIndex - 1], newGroups[currentIndex]] = [newGroups[currentIndex], newGroups[currentIndex - 1]];

        // Update local state immediately
        setBudgetGroups(newGroups);

        // Save new order to database
        try {
            const categoryIds = newGroups.map(g => g.id);
            await reorderCategories(categoryIds);
        } catch (error) {
            console.error('Error reordering categories:', error);
            // Revert on error
            await loadBudgetData();
            setNotification('Failed to save order. Please try again.');
        }
    };

    const handleMoveGroupDown = async (groupId: string) => {
        const currentIndex = budgetGroups.findIndex(g => g.id === groupId);
        if (currentIndex >= budgetGroups.length - 1) return; // Already at bottom

        // Swap with next group
        const newGroups = [...budgetGroups];
        [newGroups[currentIndex], newGroups[currentIndex + 1]] = [newGroups[currentIndex + 1], newGroups[currentIndex]];

        // Update local state immediately
        setBudgetGroups(newGroups);

        // Save new order to database
        try {
            const categoryIds = newGroups.map(g => g.id);
            await reorderCategories(categoryIds);
        } catch (error) {
            console.error('Error reordering categories:', error);
            // Revert on error
            await loadBudgetData();
            setNotification('Failed to save order. Please try again.');
        }
    };

    const handleDuplicateBudget = async () => {
        if (!duplicateTargetMonth) {
            setNotification('Please select a target month.');
            return;
        }

        if (duplicateTargetMonth === monthStr) {
            setNotification('Cannot duplicate to the same month.');
            return;
        }

        const targetDate = new Date(
            parseInt(duplicateTargetMonth.split('-')[0]),
            parseInt(duplicateTargetMonth.split('-')[1]) - 1,
            1
        );
        const targetMonthLabel = targetDate.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
        });

        if (!confirm(`Copy all budgets from ${monthLabel} to ${targetMonthLabel}?`)) {
            return;
        }

        setDuplicating(true);
        setNotification(null);

        try {
            const count = await duplicateBudgets(monthStr, duplicateTargetMonth);
            setNotification(
                `Successfully copied ${count} budget${count !== 1 ? 's' : ''} to ${targetMonthLabel}.`
            );
            setShowDuplicateDialog(false);
            setDuplicateTargetMonth('');
        } catch (error) {
            console.error('Error duplicating budgets:', error);
            setNotification(
                error instanceof Error ? error.message : 'Failed to duplicate budgets'
            );
        } finally {
            setDuplicating(false);
        }
    };

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

            {/* Budget Actions */}
            <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={() => setEditMode(!editMode)}
                    disabled={loading}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                        editMode
                            ? 'bg-amber-400 text-black hover:bg-amber-300'
                            : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                >
                    {editMode ? 'Done Editing' : 'Edit Budget'}
                </button>
                <button
                    type="button"
                    onClick={() => setShowDuplicateDialog(true)}
                    disabled={duplicating || loading || editMode}
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                    Duplicate Budget
                </button>
            </div>

            {notification && (
                <div className="rounded-md border border-emerald-600 bg-emerald-950 px-4 py-2 text-xs text-emerald-200">
                    {notification}
                </div>
            )}

            {/* Summary Section */}
            {summary && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <h3 className="mb-3 text-sm font-semibold">Ready to Assign</h3>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                            <div className="text-slate-400">Total Assigned</div>
                            <div className="text-lg font-semibold text-slate-100">
                                {formatCurrency(summary.totalAssigned)}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-400">Total Activity</div>
                            <div className="text-lg font-semibold text-slate-100">
                                {formatCurrency(summary.totalActivity)}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-400">Available</div>
                            <div className={`text-lg font-semibold ${
                                summary.totalAvailable >= 0 ? 'text-emerald-400' : 'text-blue-400'
                            }`}>
                                {formatCurrency(summary.totalAvailable)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Budget Dialog */}
            {showDuplicateDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-xs max-w-md w-full mx-4">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Duplicate Budget</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDuplicateDialog(false);
                                    setDuplicateTargetMonth('');
                                }}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="mb-4 text-slate-300">
                            Copy all budgets from <strong>{monthLabel}</strong> to another month.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-slate-300 mb-1">
                                    Target Month
                                </label>
                                <select
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                                    value={duplicateTargetMonth}
                                    onChange={e => setDuplicateTargetMonth(e.target.value)}
                                    required
                                >
                                    <option value="">Select a month</option>
                                    {getAvailableMonths().map(monthStr => {
                                        const date = new Date(
                                            parseInt(monthStr.split('-')[0]),
                                            parseInt(monthStr.split('-')[1]) - 1,
                                            1
                                        );
                                        const label = date.toLocaleString('default', {
                                            month: 'long',
                                            year: 'numeric',
                                        });
                                        return (
                                            <option key={monthStr} value={monthStr}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleDuplicateBudget}
                                    disabled={duplicating || !duplicateTargetMonth}
                                    className="flex-1 rounded-md bg-amber-400 px-3 py-2 text-[11px] font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                                >
                                    {duplicating ? 'Copying...' : 'Copy Budgets'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDuplicateDialog(false);
                                        setDuplicateTargetMonth('');
                                    }}
                                    className="rounded-md border border-slate-600 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
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
                        {showAddCategory ? 'Cancel' : '+ Add Category/Group'}
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
                                placeholder="e.g., Subscriptions, Groceries, Softr"
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
                            <label className="block text-slate-300 mb-1">Kind</label>
                            <select
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                                value={newCategoryKind}
                                onChange={e => setNewCategoryKind(e.target.value as 'group' | 'category')}
                            >
                                <option value="group">Group (Top-level category)</option>
                                <option value="category">Category (Subcategory)</option>
                            </select>
                        </div>

                        {newCategoryKind === 'category' && (
                            <div>
                                <label className="block text-slate-300 mb-1">Parent Group (Required)</label>
                                <select
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                                    value={newCategoryParentId}
                                    onChange={e => setNewCategoryParentId(e.target.value)}
                                    required={newCategoryKind === 'category'}
                                >
                                    <option value="">Select a group</option>
                                    {groupCategories.map(group => (
                                        <option key={group.id} value={group.id}>
                                            {group.type === 'income' ? '⬆️' : '⬇️'} {group.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

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

            {/* Budget Groups List */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-4 text-sm font-semibold">Budget Categories</h3>

                {loading ? (
                    <div className="text-[11px] text-slate-400">Loading budgets…</div>
                ) : budgetGroups.length === 0 ? (
                    <div className="text-[11px] text-slate-400">
                        No budget categories found. Create a group and add categories to get started.
                    </div>
                ) : (
                    <div className="space-y-1">
                        {/* Column Headers */}
                        <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 border-b border-slate-700 pb-2 mb-2 text-[10px] font-semibold text-slate-400 uppercase">
                            <div>Category</div>
                            <div className="text-right">Assigned</div>
                            <div className="text-right">Activity</div>
                            <div className="text-right">Available</div>
                        </div>

                        {budgetGroups.map((group, groupIndex) => {
                            const isCollapsed = collapsedGroups[group.id];
                            const hasCategories = group.categories.length > 0;

                            return (
                                <div key={group.id} className="space-y-0">
                                    {/* Group Row */}
                                    <div className={`rounded-md bg-slate-950 hover:bg-slate-900 transition-colors ${
                                        groupIndex < budgetGroups.length - 1 ? 'mb-1' : ''
                                    }`}>
                                        <div 
                                            className={`grid grid-cols-[1fr_100px_100px_100px] gap-2 items-center p-2 ${
                                                hasCategories && !editMode ? 'cursor-pointer' : 'cursor-default'
                                            }`}
                                            onClick={() => hasCategories && !editMode && toggleGroup(group.id)}
                                        >
                                            <div className="flex items-center gap-2 font-medium text-slate-100">
                                                {editMode && (
                                                    <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveGroupUp(group.id)}
                                                            disabled={groupIndex === 0}
                                                            className="text-[8px] px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Move up"
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveGroupDown(group.id)}
                                                            disabled={groupIndex === budgetGroups.length - 1}
                                                            className="text-[8px] px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Move down"
                                                        >
                                                            ↓
                                                        </button>
                                                    </div>
                                                )}
                                                {hasCategories && (
                                                    <span className="text-xs w-4" onClick={(e) => e.stopPropagation()}>
                                                        {isCollapsed ? '▶' : '▼'}
                                                    </span>
                                                )}
                                                {editMode && editingCategoryNames[group.id] !== undefined ? (
                                                    <input
                                                        type="text"
                                                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px]"
                                                        value={editingCategoryNames[group.id]}
                                                        onChange={e => setEditingCategoryNames(prev => ({
                                                            ...prev,
                                                            [group.id]: e.target.value
                                                        }))}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleUpdateCategoryName(group.id, editingCategoryNames[group.id]);
                                                            } else if (e.key === 'Escape') {
                                                                handleCancelEditCategoryName(group.id);
                                                            }
                                                        }}
                                                        onBlur={() => handleUpdateCategoryName(group.id, editingCategoryNames[group.id])}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span
                                                        onClick={(e) => {
                                                            if (editMode) {
                                                                e.stopPropagation();
                                                                handleStartEditCategoryName(group.id, group.name);
                                                            }
                                                        }}
                                                        className={editMode ? 'cursor-pointer hover:text-amber-400' : ''}
                                                    >
                                                        {group.type === 'income' ? '⬆️' : '⬇️'} {group.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right text-slate-300 font-medium">
                                                {formatCurrency(Math.abs(group.totalAssigned))}
                                            </div>
                                            <div className="text-right text-slate-300 font-medium">
                                                {formatCurrency(group.totalActivity)}
                                            </div>
                                            <div className={`text-right font-medium ${
                                                group.totalAvailable >= 0 
                                                    ? 'text-emerald-400' 
                                                    : group.type === 'income' 
                                                        ? 'text-blue-400'  // Overpaid (good)
                                                        : 'text-red-400'   // Overspent (bad)
                                            }`}>
                                                {formatCurrency(group.totalAvailable)}
                                            </div>
                                        </div>
                                        
                                        {/* Progress bar for group */}
                                        {group.totalAssigned > 0 && (
                                            <div className="px-2 pb-2">
                                                <div className="h-1 rounded-full bg-slate-800">
                                                    <div
                                                        className={`h-1 rounded-full ${
                                                            group.totalAvailable < 0
                                                                ? group.type === 'income' 
                                                                    ? 'bg-blue-500'  // Overpaid (good)
                                                                    : 'bg-red-500'   // Overspent (bad)
                                                                : (group.totalActivity / group.totalAssigned) > 0.9
                                                                    ? 'bg-yellow-400'
                                                                    : 'bg-emerald-500'
                                                        }`}
                                                        style={{
                                                            width: `${Math.min(100, (group.totalActivity / group.totalAssigned) * 100)}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Subcategory Rows */}
                                    {hasCategories && !isCollapsed && (
                                        <div className="ml-4 space-y-0 border-l-2 border-slate-700 pl-2">
                                            {group.categories.map((category, catIndex) => {
                                                const isEditing = editingBudgets[category.id] !== undefined;
                                                const editingValue = editingBudgets[category.id] || '';

                                                return (
                                                    <div
                                                        key={category.id}
                                                        className={`rounded-md bg-slate-900 hover:bg-slate-800 transition-colors ${
                                                            catIndex < group.categories.length - 1 ? 'mb-1' : ''
                                                        }`}
                                                    >
                                                        <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 items-center p-2">
                                                            <div className="text-slate-200 pl-4">
                                                                {editMode && editingCategoryNames[category.id] !== undefined ? (
                                                                    <input
                                                                        type="text"
                                                                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px]"
                                                                        value={editingCategoryNames[category.id]}
                                                                        onChange={e => setEditingCategoryNames(prev => ({
                                                                            ...prev,
                                                                            [category.id]: e.target.value
                                                                        }))}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleUpdateCategoryName(category.id, editingCategoryNames[category.id]);
                                                                            } else if (e.key === 'Escape') {
                                                                                handleCancelEditCategoryName(category.id);
                                                                            }
                                                                        }}
                                                                        onBlur={() => handleUpdateCategoryName(category.id, editingCategoryNames[category.id])}
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        onClick={() => {
                                                                            if (editMode) {
                                                                                handleStartEditCategoryName(category.id, category.name);
                                                                            }
                                                                        }}
                                                                        className={editMode ? 'cursor-pointer hover:text-amber-400' : ''}
                                                                    >
                                                                        {category.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-right">
                                                                {editMode || isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] text-right"
                                                                        value={isEditing ? editingValue : (category.assigned ? Math.abs(category.assigned).toString() : '')}
                                                                        placeholder="0.00"
                                                                        onChange={e => {
                                                                            if (!isEditing) {
                                                                                handleStartEditBudget(category.id);
                                                                                setEditingBudgets(prev => ({
                                                                                    ...prev,
                                                                                    [category.id]: e.target.value
                                                                                }));
                                                                            } else {
                                                                                setEditingBudgets(prev => ({
                                                                                    ...prev,
                                                                                    [category.id]: e.target.value
                                                                                }));
                                                                            }
                                                                        }}
                                                                        autoFocus={isEditing}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') {
                                                                                handleSaveBudget(category.id);
                                                                            } else if (e.key === 'Escape') {
                                                                                handleCancelEditBudget(category.id);
                                                                            }
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            const inputValue = e.target.value;
                                            
                                                                            if (editMode) {
                                                                                // In edit mode, auto-save on blur silently
                                                                                if (isEditing) {
                                                                                    // Was actively editing, save it silently
                                                                                    const val = editingBudgets[category.id];
                                                                                    if (val !== undefined) {
                                                                                        handleSaveBudget(category.id, true); // Silent save
                                                                                    }
                                                                                } else {
                                                                                    // Just entered edit mode, check if value changed
                                                                                    const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                                                                                    const currentDisplayValue = category.assigned ? Math.abs(category.assigned) : 0;
                                                                                    if (!Number.isNaN(numValue) && numValue !== currentDisplayValue) {
                                                                                        handleStartEditBudget(category.id);
                                                                                        setEditingBudgets(prev => ({
                                                                                            ...prev,
                                                                                            [category.id]: inputValue
                                                                                        }));
                                                                                        // Save silently after state update
                                                                                        setTimeout(() => {
                                                                                            handleSaveBudget(category.id, true); // Silent save
                                                                                        }, 100);
                                                                                    }
                                                                                }
                                                                            } else if (isEditing) {
                                                                                // Not in edit mode, but was editing - save silently
                                                                                const val = editingBudgets[category.id];
                                                                                if (val !== undefined && val !== '') {
                                                                                    handleSaveBudget(category.id, true); // Silent save
                                                                                } else {
                                                                                    handleCancelEditBudget(category.id);
                                                                                }
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditBudget(category.id)}
                                                                        className="w-full text-right text-slate-300 hover:text-amber-400 transition-colors"
                                                                    >
                                                                        {formatCurrency(Math.abs(category.assigned))}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="text-right text-slate-300">
                                                                {formatCurrency(category.activity)}
                                                            </div>
                                                            <div className={`text-right ${
                                                                category.available >= 0 
                                                                    ? 'text-emerald-400' 
                                                                    : group.type === 'income' 
                                                                        ? 'text-blue-400'  // Overpaid (good)
                                                                        : 'text-red-400'   // Overspent (bad)
                                                            }`}>
                                                                {formatCurrency(category.available)}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Progress bar for subcategory */}
                                                        {category.assigned > 0 && (
                                                            <div className="px-2 pb-2">
                                                                <div className="h-0.5 rounded-full bg-slate-800">
                                                                    <div
                                                                        className={`h-0.5 rounded-full ${
                                                                            category.available < 0
                                                                                ? group.type === 'income' 
                                                                                    ? 'bg-blue-500'  // Overpaid (good)
                                                                                    : 'bg-red-500'   // Overspent (bad)
                                                                                : (category.activity / category.assigned) > 0.9
                                                                                    ? 'bg-yellow-400'
                                                                                    : 'bg-emerald-500'
                                                                        }`}
                                                                        style={{
                                                                            width: `${Math.min(100, (category.activity / category.assigned) * 100)}%`
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Action buttons - show in edit mode or when budget exists */}
                                                        {editMode && !isEditing && (
                                                            <div className="px-2 pb-2 flex justify-end gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (category.assigned > 0) {
                                                                            handleDeleteBudget(category.id);
                                                                        } else {
                                                                            handleStartEditBudget(category.id);
                                                                        }
                                                                    }}
                                                                    className={`rounded px-1.5 py-0.5 text-[9px] ${
                                                                        category.assigned > 0
                                                                            ? 'bg-red-900 hover:bg-red-800'
                                                                            : 'bg-amber-900 hover:bg-amber-800'
                                                                    }`}
                                                                    title={category.assigned > 0 ? 'Delete budget' : 'Set budget'}
                                                                >
                                                                    {category.assigned > 0 ? '🗑️' : '➕'}
                                                                </button>
                                                            </div>
                                                        )}
                                                        {!editMode && !isEditing && category.assigned > 0 && (
                                                            <div className="px-2 pb-2 flex justify-end gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteBudget(category.id)}
                                                                    className="rounded bg-red-900 px-1.5 py-0.5 text-[9px] hover:bg-red-800"
                                                                    title="Delete budget"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Divider between groups */}
                                    {groupIndex < budgetGroups.length - 1 && (
                                        <div className="h-px bg-slate-700 my-2" />
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
