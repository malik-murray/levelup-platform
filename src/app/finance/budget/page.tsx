'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { getBudgetDataForMonth, saveCategoryBudget, deleteCategoryBudget, reorderCategories } from '@/lib/budgetGroups';
import { computeTotalBudgeted } from '@/lib/budgetOverview';
import type { BudgetGroup, Category, BudgetSummary } from '@/lib/types';

export default function BudgetPage() {
    const router = useRouter();
    const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>([]);
    const [summary, setSummary] = useState<BudgetSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    
    // Category creation state
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense' | 'transfer'>('expense');
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
    
    // Track editing state for category types (categoryId -> type)
    const [editingCategoryTypes, setEditingCategoryTypes] = useState<Record<string, 'income' | 'expense' | 'transfer'>>({});
    
    // Category management modal state
    const [showManageCategories, setShowManageCategories] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<string | null>(null);
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [newSubcategoryType, setNewSubcategoryType] = useState<'income' | 'expense' | 'transfer'>('expense');
    const [convertingCategory, setConvertingCategory] = useState<string | null>(null);
    const [targetParentId, setTargetParentId] = useState<string>('');

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
            const { groups, summary: summaryData } = await getBudgetDataForMonth(monthStr);
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
        let categoryType: 'income' | 'expense' | 'transfer' | null = null;
        for (const group of budgetGroups) {
            const cat = group.categories.find(c => c.id === categoryId);
            if (cat) {
                categoryType = group.type;
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
        // For transfers, use as-is (can be positive or negative depending on direction)
        let finalAmount = numAmount;
        if (numAmount !== 0) {
            if (categoryType === 'expense') {
                // Expenses should be negative
                finalAmount = Math.abs(numAmount) * -1;
            } else if (categoryType === 'income') {
                // Income should be positive
                finalAmount = Math.abs(numAmount);
            } else if (categoryType === 'transfer') {
                // Savings/investing: treat as positive amount to save
                // User enters positive amount (e.g., 500), we store as positive
                finalAmount = Math.abs(numAmount);
            } else {
                // Unknown: use as-is
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
                    } else if (group.type === 'transfer') {
                        // For savings/investing: assigned is positive, activity is positive
                        newAvailable = Math.abs(newAssigned) - category.activity;
                    } else {
                        // For unknown
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
                    // For savings/investing, use absolute values
                    const totalAssigned = updatedCategories.reduce((sum, c) => {
                        if (group.type === 'expense') {
                            return sum + Math.abs(c.assigned);
                        } else if (group.type === 'transfer') {
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
                
                // Recalculate summary from updated groups (preserve cashflow totals)
                const totalAssigned = updatedGroups.reduce((sum, group) => sum + group.totalAssigned, 0);
                const totalActivity = updatedGroups.reduce((sum, group) => sum + group.totalActivity, 0);
                const totalAvailable = totalAssigned - totalActivity;
                const totalBudgeted = computeTotalBudgeted(updatedGroups);

                setSummary((prev) => ({
                    totalAssigned,
                    totalActivity,
                    totalAvailable,
                    totalBudgeted,
                    totalIncome: prev?.totalIncome ?? 0,
                    totalExpenses: prev?.totalExpenses ?? 0,
                }));
                
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
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setNotification('You must be logged in to create categories.');
                setCreatingCategory(false);
                return;
            }

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
                    user_id: user.id,
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
            
            // Reload categories in manage modal if open
            if (showManageCategories) {
                const { data: updatedCategories } = await supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .order('name');
                setAllCategories((updatedCategories as Category[]) ?? []);
            }
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
    
    // Organize categories into hierarchy for display
    const categoryHierarchy = useMemo(() => {
        const groups = allCategories.filter(c => c.kind === 'group');
        const categories = allCategories.filter(c => c.kind === 'category');
        const standalone = categories.filter(c => !c.parent_id);
        
        // Build tree structure
        const tree: Array<{
            category: Category;
            children: Category[];
            level: number;
        }> = [];
        
        // Add groups with their children
        groups.forEach(group => {
            const children = categories.filter(c => c.parent_id === group.id);
            tree.push({
                category: group,
                children,
                level: 0,
            });
        });
        
        // Add standalone categories
        standalone.forEach(cat => {
            tree.push({
                category: cat,
                children: [],
                level: 0,
            });
        });
        
        return tree;
    }, [allCategories]);
    
    // Get all potential parent categories (groups and standalone categories)
    const potentialParents = useMemo(() => {
        const groups = allCategories.filter(c => c.kind === 'group');
        const standalone = allCategories.filter(c => c.kind === 'category' && !c.parent_id);
        return [...groups, ...standalone];
    }, [allCategories]);
    
    // Toggle category expansion
    const toggleCategoryExpansion = (categoryId: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    };
    
    // Add subcategory to a category
    const handleAddSubcategory = async (parentId: string, name: string, type: 'income' | 'expense' | 'transfer') => {
        if (!name.trim()) {
            setNotification('Subcategory name is required.');
            return;
        }
        
        setNotification(null);
        
        try {
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setNotification('You must be logged in to create subcategories.');
                return;
            }

            const parent = allCategories.find(c => c.id === parentId);
            if (!parent) {
                setNotification('Parent category not found.');
                return;
            }
            
            const { error } = await supabase
                .from('categories')
                .insert({
                    name: name.trim(),
                    kind: 'category',
                    type: type,
                    parent_id: parentId,
                    user_id: user.id,
                });
            
            if (error) {
                throw new Error(error.message);
            }
            
            // Reload categories
            const { data: categoriesData } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .order('name');
            
            setAllCategories((categoriesData as Category[]) ?? []);
            await loadBudgetData();
            
            // Reload categories in manage modal if open
            if (showManageCategories) {
                const { data: updatedCategories } = await supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .order('name');
                setAllCategories((updatedCategories as Category[]) ?? []);
            }
            
            setAddingSubcategoryTo(null);
            setNewSubcategoryName('');
            setNotification('Subcategory added successfully.');
        } catch (error) {
            console.error('Error adding subcategory:', error);
            setNotification(
                error instanceof Error ? error.message : 'Failed to add subcategory'
            );
        }
    };
    
    // Convert category to subcategory
    const handleConvertToSubcategory = async (categoryId: string, newParentId: string) => {
        if (!newParentId) {
            setNotification('Please select a parent category.');
            return;
        }
        
        // Prevent circular reference
        if (categoryId === newParentId) {
            setNotification('A category cannot be its own parent.');
            return;
        }
        
        // Check if new parent is a descendant (would create cycle)
        const checkCycle = (parentId: string, targetId: string): boolean => {
            const parent = allCategories.find(c => c.id === parentId);
            if (!parent || !parent.parent_id) return false;
            if (parent.parent_id === targetId) return true;
            return checkCycle(parent.parent_id, targetId);
        };
        
        if (checkCycle(newParentId, categoryId)) {
            setNotification('Cannot create circular reference. This would make a category its own ancestor.');
            return;
        }
        
        setNotification(null);
        
        try {
            const { error } = await supabase
                .from('categories')
                .update({ parent_id: newParentId })
                .eq('id', categoryId);
            
            if (error) {
                throw new Error(error.message);
            }
            
            // Reload categories
            const { data: categoriesData } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .order('name');
            
            setAllCategories((categoriesData as Category[]) ?? []);
            await loadBudgetData();
            
            // Reload categories in manage modal if open
            if (showManageCategories) {
                const { data: updatedCategories } = await supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .order('name');
                setAllCategories((updatedCategories as Category[]) ?? []);
            }
            
            setConvertingCategory(null);
            setTargetParentId('');
            setNotification('Category converted to subcategory successfully.');
        } catch (error) {
            console.error('Error converting category:', error);
            setNotification(
                error instanceof Error ? error.message : 'Failed to convert category'
            );
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(amount);
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
            
            // Reload categories in manage modal if open
            if (showManageCategories) {
                const { data: updatedCategories } = await supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .order('name');
                setAllCategories((updatedCategories as Category[]) ?? []);
            }

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

    const handleUpdateCategoryType = async (categoryId: string, newType: 'income' | 'expense' | 'transfer') => {
        setNotification(null);

        try {
            const { error } = await supabase
                .from('categories')
                .update({ type: newType })
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
            
            // Reload categories in manage modal if open
            if (showManageCategories) {
                const { data: updatedCategories } = await supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .order('name');
                setAllCategories((updatedCategories as Category[]) ?? []);
            }

            setNotification('Category type updated successfully.');
        } catch (error) {
            console.error('Error updating category type:', error);
            setNotification(
                error instanceof Error ? error.message : 'Failed to update category type'
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

    const handleDeleteCategory = async (categoryId: string, categoryName: string, isGroup: boolean) => {
        // First, verify the category exists and get its kind
        const { data: categoryData, error: fetchError } = await supabase
            .from('categories')
            .select('id, name, kind, parent_id')
            .eq('id', categoryId)
            .single();

        if (fetchError || !categoryData) {
            setNotification('Category not found.');
            return;
        }

        const actualKind = categoryData.kind;
        const isActuallyGroup = actualKind === 'group';

        // Check if it's a group with subcategories
        if (isActuallyGroup) {
            // Get all subcategories for this group
            const { data: subcategories } = await supabase
                .from('categories')
                .select('id')
                .eq('parent_id', categoryId);

            const subcategoryCount = subcategories?.length || 0;
            
            if (subcategoryCount > 0) {
                const confirmMessage = `This group has ${subcategoryCount} subcategor${subcategoryCount === 1 ? 'y' : 'ies'}. Deleting it will also delete all subcategories. Are you sure?`;
                if (!confirm(confirmMessage)) {
                    return;
                }
            } else {
                if (!confirm(`Are you sure you want to delete the category group "${categoryName}"?`)) {
                    return;
                }
            }
        } else {
            // Check if subcategory has budgets or transactions
            const group = budgetGroups.find(g => g.categories.some(c => c.id === categoryId));
            const category = group?.categories.find(c => c.id === categoryId);
            
            let warningMessage = `Are you sure you want to delete "${categoryName}"?`;
            if (category && category.assigned !== 0) {
                warningMessage += `\n\nThis category has a budget assigned. The budget will be deleted.`;
            }
            if (category && category.activity !== 0) {
                warningMessage += `\n\nThis category has ${category.activity > 0 ? 'income' : 'expense'} activity. Transactions will be uncategorized.`;
            }
            
            if (!confirm(warningMessage)) {
                return;
            }
        }

        setNotification(null);

        try {
            // If it's a group, first delete all subcategories
            if (isActuallyGroup) {
                // Get all subcategories for this group
                const { data: subcategories } = await supabase
                    .from('categories')
                    .select('id')
                    .eq('parent_id', categoryId);

                const subcategoryIds = subcategories?.map(s => s.id) || [];
                
                if (subcategoryIds.length > 0) {
                    // Delete budgets for subcategories
                    for (const subId of subcategoryIds) {
                        // Delete all budgets for this category across all months
                        const { error: budgetError } = await supabase
                            .from('category_budgets')
                            .delete()
                            .eq('category_id', subId);
                        
                        if (budgetError) {
                            console.error('Error deleting budgets:', budgetError);
                        }
                    }
                    
                    // Set transactions to null (uncategorized) for subcategories
                    const { error: txError } = await supabase
                        .from('transactions')
                        .update({ category_id: null })
                        .in('category_id', subcategoryIds);
                    
                    if (txError) {
                        console.error('Error updating transactions:', txError);
                    }
                    
                    // Delete subcategories
                    const { error: subError } = await supabase
                        .from('categories')
                        .delete()
                        .in('id', subcategoryIds);
                    
                    if (subError) {
                        throw new Error(`Failed to delete subcategories: ${subError.message}`);
                    }
                }
            } else {
                // For subcategories, delete budgets first
                const { error: budgetError } = await supabase
                    .from('category_budgets')
                    .delete()
                    .eq('category_id', categoryId);
                
                if (budgetError) {
                    console.error('Error deleting budgets:', budgetError);
                }
                
                // Set transactions to null (uncategorized) instead of deleting them
                const { error: txError } = await supabase
                    .from('transactions')
                    .update({ category_id: null })
                    .eq('category_id', categoryId);
                
                if (txError) {
                    console.error('Error updating transactions:', txError);
                }
            }
            
            // Delete the category itself
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', categoryId);

            if (error) {
                throw new Error(error.message);
            }

            setNotification(`Category "${categoryName}" deleted successfully.`);

            // Reload categories and budget data
            const { data: categoriesData } = await supabase
                .from('categories')
                .select('id, name, kind, parent_id, type')
                .order('name');
            
            setAllCategories((categoriesData as Category[]) ?? []);
            await loadBudgetData();
            
            // Reload categories in manage modal if open
            if (showManageCategories) {
                const { data: updatedCategories } = await supabase
                    .from('categories')
                    .select('id, name, kind, parent_id, type')
                    .order('name');
                setAllCategories((updatedCategories as Category[]) ?? []);
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            setNotification(
                error instanceof Error 
                    ? `Error deleting category: ${error.message}` 
                    : 'Error deleting category. Check console/logs.'
            );
        }
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

    return (
        <section className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Financial Plan</h2>
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
                    {editMode ? 'Done Editing' : 'Edit Plan'}
                </button>
            </div>

            {notification && (
                <div className="rounded-md border border-emerald-600 bg-emerald-950 px-4 py-2 text-xs text-emerald-200">
                    {notification}
                </div>
            )}

            {/* Summary Section */}
            {summary && (() => {
                // Income/Expenses use all non-transfer transactions (same as transactions page),
                // not only amounts sitting in income-/expense-typed categories.
                const transferGroups = budgetGroups.filter(g => g.type === 'transfer');

                const totalIncome = summary.totalIncome;
                const totalExpenses = summary.totalExpenses;
                const totalBudgeted = summary.totalBudgeted;
                const incomeAvailable = totalIncome - totalBudgeted;
                const expenseAvailable = totalBudgeted - totalExpenses;

                const savingsActivity = transferGroups.reduce((sum, g) => sum + Math.abs(g.totalActivity), 0);
                // Same pattern as Income Available: actual activity minus amount budgeted/goal.
                const savingsAssigned = transferGroups.reduce((sum, g) => sum + Math.abs(g.totalAssigned), 0);
                const savingsRemaining = savingsActivity - savingsAssigned;
                
                return (
                    <div className="space-y-3">
                        {/* Income vs Expenses Summary */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                <div className="rounded-md border border-emerald-700/50 bg-emerald-950/30 p-3">
                                    <div className="text-emerald-400 text-[10px] font-semibold uppercase mb-1">⬆️ Income</div>
                                    <div className="text-lg font-semibold text-emerald-400 mb-1">
                                        {formatCurrency(totalIncome)}
                                    </div>
                                    <div className={`text-[10px] font-medium mt-1 ${
                                        incomeAvailable >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                        Expected: {formatCurrency(incomeAvailable)}
                                    </div>
                                </div>
                                <div className="rounded-md border border-red-700/50 bg-red-950/30 p-3">
                                    <div className="text-red-400 text-[10px] font-semibold uppercase mb-1">⬇️ Expenses</div>
                                    <div className={`text-lg font-semibold mb-1 ${
                                        totalExpenses <= totalBudgeted ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                        {formatCurrency(totalExpenses)}
                                    </div>
                                    <div className={`text-[10px] font-medium mt-1 ${
                                        expenseAvailable >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    }`}>
                                        Available: {formatCurrency(expenseAvailable)}
                                    </div>
                                </div>
                                <div className="rounded-md border border-blue-700/50 bg-blue-950/30 p-3">
                                    <div className="text-blue-400 text-[10px] font-semibold uppercase mb-1">💰 Savings/Investing</div>
                                    <div className={`text-lg font-semibold mb-1 ${
                                        savingsActivity > 0 ? 'text-emerald-400' : 'text-slate-300'
                                    }`}>
                                        {formatCurrency(savingsActivity)}
                                    </div>
                                    <div className={`text-[10px] font-medium mt-1 ${
                                        savingsRemaining >= 0 ? 'text-blue-300' : 'text-red-400'
                                    }`}>
                                        Remaining: {formatCurrency(savingsRemaining)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Categories list */}
            <div className="relative rounded-lg border border-slate-800 bg-slate-900 p-4 text-xs">
                <h3 className="mb-4 text-sm font-semibold">Categories</h3>

                {loading ? (
                    <div className="text-[11px] text-slate-400">Loading…</div>
                ) : budgetGroups.length === 0 ? (
                    <div className="text-[11px] text-slate-400">
                        No categories found. Use Edit Categories to create a group and add categories.
                    </div>
                ) : (() => {
                    // Separate groups by type
                    // Filter out virtual standalone groups for separate display
                    const realGroups = budgetGroups.filter(g => !g.id.startsWith('__standalone_'));
                    const standaloneGroups = budgetGroups.filter(g => g.id.startsWith('__standalone_'));
                    
                    const incomeGroups = realGroups.filter(g => g.type === 'income');
                    const plainTransferGroups = realGroups.filter(g =>
                        g.name.trim().toLowerCase() === 'transfer' ||
                        g.name.trim().toLowerCase() === 'transfers'
                    );
                    const expenseGroups = realGroups.filter(
                        g =>
                            g.type === 'expense' &&
                            g.name.trim().toLowerCase() !== 'transfer' &&
                            g.name.trim().toLowerCase() !== 'transfers'
                    );
                    const transferGroups = realGroups.filter(g => g.type === 'transfer' || g.type === null);
                    
                    const renderGroup = (group: BudgetGroup, groupIndex: number, totalInSection: number, allGroups: BudgetGroup[]) => {
                        const isCollapsed = collapsedGroups[group.id];
                        const hasCategories = group.categories.length > 0;
                        const globalIndex = allGroups.findIndex(g => g.id === group.id);

                        return (
                            <div key={group.id} className="space-y-0">
                                {/* Group Row */}
                                <div className={`rounded-md bg-slate-950 hover:bg-slate-900 transition-colors ${
                                    groupIndex < totalInSection - 1 ? 'mb-1' : ''
                                }`}>
                                        <div 
                                            className={`p-2 ${
                                                hasCategories && !editMode ? 'cursor-pointer' : 'cursor-default'
                                            }`}
                                            onClick={() => hasCategories && !editMode && toggleGroup(group.id)}
                                        >
                                            {/* Mobile: Stack layout, Desktop: Grid layout */}
                                            <div className="flex flex-col sm:grid sm:grid-cols-[1fr_100px_100px_100px] gap-2 items-center">
                                                <div className="flex items-center gap-2 font-medium text-slate-100 w-full">
                                                    {editMode && (
                                                        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveGroupUp(group.id)}
                                                                disabled={globalIndex === 0}
                                                                className="text-[8px] px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title="Move up"
                                                            >
                                                                ↑
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveGroupDown(group.id)}
                                                                disabled={globalIndex === allGroups.length - 1}
                                                                className="text-[8px] px-1 py-0.5 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                                title="Move down"
                                                            >
                                                                ↓
                                                            </button>
                                                        </div>
                                                    )}
                                                    {hasCategories && (
                                                        <span className="text-xs w-4">
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
                                                            {group.name.trim().toLowerCase() === 'transfer' ||
                                                            group.name.trim().toLowerCase() === 'transfers'
                                                                ? '↔'
                                                                : group.type === 'income'
                                                                  ? '⬆️'
                                                                  : group.type === 'transfer'
                                                                    ? '💰'
                                                                    : '⬇️'}{' '}
                                                            {group.name}
                                                        </span>
                                                    )}
                                                    {editMode && editingCategoryNames[group.id] === undefined && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteCategory(group.id, group.name, true);
                                                            }}
                                                            className="ml-auto rounded bg-red-900 px-1.5 py-0.5 text-[9px] hover:bg-red-800 text-red-200"
                                                            title="Delete category group"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Mobile: Show amounts in a row below name */}
                                                <div className="flex sm:hidden w-full justify-between text-xs mt-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-400 text-[10px]">Assigned</span>
                                                        <span className="text-slate-300 font-medium">{formatCurrency(Math.abs(group.totalAssigned))}</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-slate-400 text-[10px]">Activity</span>
                                                        <span className="text-slate-300 font-medium">{formatCurrency(group.totalActivity)}</span>
                                                    </div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-slate-400 text-[10px]">Available</span>
                                                        <span className={`font-medium ${
                                                            group.totalAvailable >= 0 
                                                                ? 'text-emerald-400' 
                                                                : group.type === 'income' 
                                                                    ? 'text-blue-400'
                                                                    : 'text-red-400'
                                                        }`}>
                                                            {formatCurrency(group.totalAvailable)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Desktop: Show amounts in grid columns */}
                                                <div className="hidden sm:block text-right text-slate-300 font-medium">
                                                    {formatCurrency(Math.abs(group.totalAssigned))}
                                                </div>
                                                <div className="hidden sm:block text-right text-slate-300 font-medium">
                                                    {formatCurrency(group.totalActivity)}
                                                </div>
                                                <div className={`hidden sm:block text-right font-medium ${
                                                    group.totalAvailable >= 0 
                                                        ? 'text-emerald-400' 
                                                        : group.type === 'income' 
                                                            ? 'text-blue-400'
                                                            : 'text-red-400'
                                                }`}>
                                                    {formatCurrency(group.totalAvailable)}
                                                </div>
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
                                                        role={!editMode ? 'button' : undefined}
                                                        tabIndex={!editMode ? 0 : undefined}
                                                        onClick={() => {
                                                            if (!editMode) {
                                                                router.push(
                                                                    `/finance/budget/category/${category.id}?month=${monthStr}`
                                                                );
                                                            }
                                                        }}
                                                        onKeyDown={e => {
                                                            if (
                                                                !editMode &&
                                                                (e.key === 'Enter' || e.key === ' ')
                                                            ) {
                                                                e.preventDefault();
                                                                router.push(
                                                                    `/finance/budget/category/${category.id}?month=${monthStr}`
                                                                );
                                                            }
                                                        }}
                                                        className={`rounded-md bg-slate-900 hover:bg-slate-800 transition-colors ${
                                                            !editMode ? 'cursor-pointer' : ''
                                                        } ${
                                                            catIndex < group.categories.length - 1 ? 'mb-1' : ''
                                                        }`}
                                                    >
                                                        <div className="p-2">
                                                            {/* Mobile: Stack layout, Desktop: Grid layout */}
                                                            <div className="flex flex-col sm:grid sm:grid-cols-[1fr_100px_100px_100px] gap-2 items-center">
                                                                <div className="text-slate-200 pl-4 flex items-center gap-2 w-full">
                                                                    {editMode && editingCategoryNames[category.id] !== undefined ? (
                                                                        <input
                                                                            type="text"
                                                                            className="flex-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px]"
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
                                                                            onClick={e => e.stopPropagation()}
                                                                            autoFocus
                                                                        />
                                                                    ) : editMode ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={e => {
                                                                                e.stopPropagation();
                                                                                handleStartEditCategoryName(category.id, category.name);
                                                                            }}
                                                                            className="text-left cursor-pointer hover:text-amber-400"
                                                                        >
                                                                            {category.name}
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-left">{category.name}</span>
                                                                    )}
                                                                    {editMode && editingCategoryNames[category.id] === undefined && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={e => {
                                                                                e.stopPropagation();
                                                                                handleDeleteCategory(category.id, category.name, false);
                                                                            }}
                                                                            className="rounded bg-red-900 px-1.5 py-0.5 text-[9px] hover:bg-red-800 text-red-200"
                                                                            title="Delete category"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {/* Mobile: Show amounts in a row below name */}
                                                                <div
                                                                    className="flex sm:hidden w-full justify-between text-xs mt-1 pl-4"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span className="text-slate-400 text-[10px]">Assigned</span>
                                                                        {editMode || isEditing ? (
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] text-right"
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
                                                                                        if (isEditing) {
                                                                                            const val = editingBudgets[category.id];
                                                                                            if (val !== undefined) {
                                                                                                handleSaveBudget(category.id, true);
                                                                                            }
                                                                                        } else {
                                                                                            const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                                                                                            const currentDisplayValue = category.assigned ? Math.abs(category.assigned) : 0;
                                                                                            if (!Number.isNaN(numValue) && numValue !== currentDisplayValue) {
                                                                                                handleStartEditBudget(category.id);
                                                                                                setEditingBudgets(prev => ({
                                                                                                    ...prev,
                                                                                                    [category.id]: inputValue
                                                                                                }));
                                                                                                setTimeout(() => {
                                                                                                    handleSaveBudget(category.id, true);
                                                                                                }, 100);
                                                                                            }
                                                                                        }
                                                                                    } else if (isEditing) {
                                                                                        const val = editingBudgets[category.id];
                                                                                        if (val !== undefined && val !== '') {
                                                                                            handleSaveBudget(category.id, true);
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
                                                                                className="text-slate-300 hover:text-amber-400 transition-colors text-left"
                                                                            >
                                                                                {formatCurrency(Math.abs(category.assigned))}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-slate-400 text-[10px]">Activity</span>
                                                                        <span className="text-slate-300">{formatCurrency(category.activity)}</span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-slate-400 text-[10px]">Available</span>
                                                                        <span className={
                                                                            category.available >= 0 
                                                                                ? 'text-emerald-400' 
                                                                                : group.type === 'income' 
                                                                                    ? 'text-blue-400'
                                                                                    : 'text-red-400'
                                                                        }>
                                                                            {formatCurrency(category.available)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {/* Desktop: Show amounts in grid columns */}
                                                                <div className="hidden sm:block text-right" onClick={e => e.stopPropagation()}>
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
                                                                                    if (isEditing) {
                                                                                        const val = editingBudgets[category.id];
                                                                                        if (val !== undefined) {
                                                                                            handleSaveBudget(category.id, true);
                                                                                        }
                                                                                    } else {
                                                                                        const numValue = inputValue === '' ? 0 : parseFloat(inputValue);
                                                                                        const currentDisplayValue = category.assigned ? Math.abs(category.assigned) : 0;
                                                                                        if (!Number.isNaN(numValue) && numValue !== currentDisplayValue) {
                                                                                            handleStartEditBudget(category.id);
                                                                                            setEditingBudgets(prev => ({
                                                                                                ...prev,
                                                                                                [category.id]: inputValue
                                                                                            }));
                                                                                            setTimeout(() => {
                                                                                                handleSaveBudget(category.id, true);
                                                                                            }, 100);
                                                                                        }
                                                                                    }
                                                                                } else if (isEditing) {
                                                                                    const val = editingBudgets[category.id];
                                                                                    if (val !== undefined && val !== '') {
                                                                                        handleSaveBudget(category.id, true);
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
                                                                <div className="hidden sm:block text-right text-slate-300">
                                                                    {formatCurrency(category.activity)}
                                                                </div>
                                                                <div className={`hidden sm:block text-right ${
                                                                    category.available >= 0 
                                                                        ? 'text-emerald-400' 
                                                                        : group.type === 'income' 
                                                                            ? 'text-blue-400'
                                                                            : 'text-red-400'
                                                                }`}>
                                                                    {formatCurrency(category.available)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Progress bar for subcategory */}
                                                        {(category.assigned !== 0 || category.activity > 0) && (
                                                            <div className="px-2 pb-2">
                                                                <div className="h-0.5 rounded-full bg-slate-800">
                                                                    <div
                                                                        className={`h-0.5 rounded-full ${
                                                                            category.available < 0
                                                                                ? group.type === 'income' 
                                                                                    ? 'bg-blue-500'  // Overpaid (good)
                                                                                    : 'bg-red-500'   // Overspent (bad)
                                                                                : category.assigned !== 0 && (category.activity / Math.abs(category.assigned)) > 0.9
                                                                                    ? 'bg-yellow-400'
                                                                                    : 'bg-emerald-500'
                                                                        }`}
                                                                        style={{
                                                                            width: category.assigned !== 0 
                                                                                ? `${Math.min(100, (category.activity / Math.abs(category.assigned)) * 100)}%`
                                                                                : category.activity > 0 
                                                                                    ? '100%' 
                                                                                    : '0%'
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
                                    {groupIndex < totalInSection - 1 && (
                                        <div className="h-px bg-slate-700 my-2" />
                                    )}
                                </div>
                            );
                    };
                    
                    return (
                        <div className="space-y-4">
                            {/* Column Headers */}
                            <div className="hidden sm:grid grid-cols-[1fr_100px_100px_100px] gap-2 border-b border-slate-700 pb-2 text-[10px] font-semibold text-slate-400 uppercase">
                                <div>Category</div>
                                <div className="text-right">Assigned</div>
                                <div className="text-right">Activity</div>
                                <div className="text-right">Available</div>
                            </div>
                            
                            {/* Income Section */}
                            {incomeGroups.length > 0 && (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-emerald-700/30">
                                        <span className="text-emerald-400 text-[11px] font-semibold">⬆️ INCOME</span>
                                        <span className="text-[10px] text-slate-500">
                                            ({formatCurrency(incomeGroups.reduce((sum, g) => sum + g.totalAssigned, 0))} assigned)
                                        </span>
                                    </div>
                                    {incomeGroups.map((group, idx) => renderGroup(group, idx, incomeGroups.length, budgetGroups))}
                                    {standaloneGroups.filter(g => g.type === 'income').map((group, idx) => renderGroup(group, idx, standaloneGroups.filter(g => g.type === 'income').length, budgetGroups))}
                                </div>
                            )}
                            
                            {/* Expense Section */}
                            {expenseGroups.length > 0 && (
                                <div className="space-y-1">
                                    {incomeGroups.length > 0 && <div className="h-4" />}
                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-red-700/30">
                                        <span className="text-red-400 text-[11px] font-semibold">⬇️ EXPENSES</span>
                                        <span className="text-[10px] text-slate-500">
                                            ({formatCurrency(expenseGroups.reduce((sum, g) => sum + Math.abs(g.totalAssigned), 0))} assigned)
                                        </span>
                                    </div>
                                    {expenseGroups.map((group, idx) => renderGroup(group, idx, expenseGroups.length, budgetGroups))}
                                    {standaloneGroups.filter(g => g.type === 'expense' && g.name.trim().toLowerCase() !== 'transfer' && g.name.trim().toLowerCase() !== 'transfers').map((group, idx) => renderGroup(group, idx, standaloneGroups.filter(g => g.type === 'expense').length, budgetGroups))}
                                </div>
                            )}

                            {/* Transfer Section — account-to-account moves as budget categories */}
                            {(plainTransferGroups.length > 0 ||
                                standaloneGroups.some(
                                    g =>
                                        g.name.trim().toLowerCase() === 'transfer' ||
                                        g.name.trim().toLowerCase() === 'transfers'
                                )) && (
                                <div className="space-y-1">
                                    {(incomeGroups.length > 0 || expenseGroups.length > 0) && (
                                        <div className="h-4" />
                                    )}
                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-600/50">
                                        <span className="text-slate-300 text-[11px] font-semibold">
                                            ↔ TRANSFERS
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            (
                                            {formatCurrency(
                                                plainTransferGroups.reduce(
                                                    (sum, g) => sum + Math.abs(g.totalActivity),
                                                    0
                                                )
                                            )}{' '}
                                            moved)
                                        </span>
                                    </div>
                                    {plainTransferGroups.map((group, idx) =>
                                        renderGroup(group, idx, plainTransferGroups.length, budgetGroups)
                                    )}
                                    {standaloneGroups
                                        .filter(
                                            g =>
                                                g.name.trim().toLowerCase() === 'transfer' ||
                                                g.name.trim().toLowerCase() === 'transfers'
                                        )
                                        .map((group, idx) =>
                                            renderGroup(
                                                group,
                                                idx,
                                                standaloneGroups.filter(
                                                    g =>
                                                        g.name.trim().toLowerCase() === 'transfer' ||
                                                        g.name.trim().toLowerCase() === 'transfers'
                                                ).length,
                                                budgetGroups
                                            )
                                        )}
                                </div>
                            )}
                            
                            {/* Savings/Investing Section */}
                            {transferGroups.length > 0 && (
                                <div className="space-y-1">
                                    {(incomeGroups.length > 0 || expenseGroups.length > 0 || plainTransferGroups.length > 0) && <div className="h-4" />}
                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-700/50">
                                        <span className="text-slate-400 text-[11px] font-semibold">💰 SAVINGS/INVESTING</span>
                                    </div>
                                    {transferGroups.map((group, idx) => renderGroup(group, idx, transferGroups.length, budgetGroups))}
                                    {standaloneGroups.filter(g => g.type === 'transfer' || g.type === null).map((group, idx) => renderGroup(group, idx, standaloneGroups.filter(g => g.type === 'transfer' || g.type === null).length, budgetGroups))}
                                </div>
                            )}

                            {(() => {
                                const totalAssigned = budgetGroups.reduce(
                                    (sum, g) => sum + Math.abs(g.totalAssigned),
                                    0
                                );
                                const totalActivity = budgetGroups.reduce(
                                    (sum, g) => sum + g.totalActivity,
                                    0
                                );
                                const totalAvailable = totalAssigned - totalActivity;
                                return (
                                    <div className="mt-4 border-t border-slate-700 pt-3">
                                        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_100px_100px_100px] gap-2 items-center px-2 py-1">
                                            <div className="text-sm font-semibold text-slate-100">
                                                Totals
                                            </div>
                                            <div className="flex sm:contents w-full justify-between text-xs gap-4">
                                                <div className="flex flex-col sm:block text-right">
                                                    <span className="sm:hidden text-slate-400 text-[10px]">
                                                        Total Assigned
                                                    </span>
                                                    <span className="font-semibold text-slate-100">
                                                        {formatCurrency(totalAssigned)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col sm:block text-right">
                                                    <span className="sm:hidden text-slate-400 text-[10px]">
                                                        Total Activity
                                                    </span>
                                                    <span className="font-semibold text-slate-100">
                                                        {formatCurrency(totalActivity)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col sm:block text-right">
                                                    <span className="sm:hidden text-slate-400 text-[10px]">
                                                        Total Available
                                                    </span>
                                                    <span
                                                        className={`font-semibold ${
                                                            totalAvailable >= 0
                                                                ? 'text-emerald-400'
                                                                : 'text-red-400'
                                                        }`}
                                                    >
                                                        {formatCurrency(totalAvailable)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    );
                })()}

                <button
                    type="button"
                    onClick={() => setShowManageCategories(true)}
                    className="fixed bottom-6 right-6 z-40 rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-black/40 hover:bg-amber-300"
                >
                    Edit Categories
                </button>
            </div>
            
            {/* Manage Categories Modal */}
            {showManageCategories && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] rounded-lg border border-slate-700 bg-slate-900 flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-800">
                            <h3 className="text-lg font-semibold">Edit Categories</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCategory(!showAddCategory)}
                                    className="rounded-md bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-amber-300"
                                >
                                    {showAddCategory ? 'Cancel' : '+ Add Category/Group'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowManageCategories(false);
                                        setShowAddCategory(false);
                                        setAddingSubcategoryTo(null);
                                        setConvertingCategory(null);
                                        setExpandedCategories(new Set());
                                    }}
                                    className="rounded-md p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {showAddCategory && (
                                <form onSubmit={handleCreateCategory} className="mb-3 space-y-3 rounded-md border border-slate-700 bg-slate-950 p-3 text-xs">
                                    <div>
                                        <label className="block text-slate-300 mb-1">Category Name</label>
                                        <input
                                            type="text"
                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            placeholder="e.g., Subscriptions, Groceries"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-300 mb-1">Type</label>
                                        <select
                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1"
                                            value={newCategoryType}
                                            onChange={e => setNewCategoryType(e.target.value as 'income' | 'expense' | 'transfer')}
                                        >
                                            <option value="expense">⬇️ Expense</option>
                                            <option value="income">⬆️ Income</option>
                                            <option value="transfer">💰 Savings/Investing</option>
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
                                                        {group.type === 'income' ? '⬆️' : group.type === 'transfer' ? '💰' : '⬇️'} {group.name}
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
                            {categoryHierarchy.map(({ category, children, level }) => {
                                const isExpanded = expandedCategories.has(category.id);
                                const isGroup = category.kind === 'group';
                                const hasChildren = children.length > 0;
                                const isAdding = addingSubcategoryTo === category.id;
                                const isConverting = convertingCategory === category.id;
                                const isChangingType = editingCategoryTypes[category.id] !== undefined;
                                
                                return (
                                    <div key={category.id} className="space-y-1">
                                        {/* Category Row */}
                                        <div className={`flex items-center gap-2 p-2 rounded-md bg-slate-950 hover:bg-slate-900 ${
                                            level > 0 ? 'ml-6' : ''
                                        }`}>
                                            {/* Expand/Collapse */}
                                            {hasChildren && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCategoryExpansion(category.id)}
                                                    className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-200"
                                                >
                                                    {isExpanded ? '▼' : '▶'}
                                                </button>
                                            )}
                                            {!hasChildren && <div className="w-4" />}
                                            
                                            {/* Category Name */}
                                            <div className="flex-1 flex items-center gap-2">
                                                <span className="text-sm text-slate-200">
                                                    {category.type === 'income' ? '⬆️' : category.type === 'transfer' ? '💰' : '⬇️'} {category.name}
                                                </span>
                                                {isGroup && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                                        Group
                                                    </span>
                                                )}
                                                {category.kind === 'category' && !category.parent_id && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                                        Standalone
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Actions */}
                                            <div className="flex items-center gap-1">
                                                {isGroup && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddingSubcategoryTo(category.id);
                                                            setNewSubcategoryName('');
                                                            setNewSubcategoryType(category.type || 'expense');
                                                        }}
                                                        className="text-[10px] px-2 py-1 rounded bg-emerald-900 text-emerald-200 hover:bg-emerald-800"
                                                    >
                                                        + Subcategory
                                                    </button>
                                                )}
                                                {category.kind === 'category' && !category.parent_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setConvertingCategory(category.id);
                                                            setTargetParentId('');
                                                        }}
                                                        className="text-[10px] px-2 py-1 rounded bg-blue-900 text-blue-200 hover:bg-blue-800"
                                                    >
                                                        Convert to Subcategory
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEditCategoryName(category.id, category.name)}
                                                    className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                >
                                                    Rename
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingCategoryTypes(prev => ({
                                                            ...prev,
                                                            [category.id]: (category.type || 'expense') as 'income' | 'expense' | 'transfer'
                                                        }));
                                                    }}
                                                    className="text-[10px] px-2 py-1 rounded bg-purple-900 text-purple-200 hover:bg-purple-800"
                                                >
                                                    Change Type
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteCategory(category.id, category.name, isGroup)}
                                                    className="text-[10px] px-2 py-1 rounded bg-red-900 text-red-200 hover:bg-red-800"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Add Subcategory Form */}
                                        {isAdding && (
                                            <div className="ml-8 p-3 rounded-md bg-slate-950 border border-slate-700 space-y-2">
                                                <input
                                                    type="text"
                                                    value={newSubcategoryName}
                                                    onChange={e => setNewSubcategoryName(e.target.value)}
                                                    placeholder="Subcategory name"
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                                    autoFocus
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            handleAddSubcategory(category.id, newSubcategoryName, newSubcategoryType);
                                                        } else if (e.key === 'Escape') {
                                                            setAddingSubcategoryTo(null);
                                                            setNewSubcategoryName('');
                                                        }
                                                    }}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={newSubcategoryType}
                                                        onChange={e => setNewSubcategoryType(e.target.value as 'income' | 'expense' | 'transfer')}
                                                        className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                                    >
                                                        <option value="expense">Expense</option>
                                                        <option value="income">Income</option>
                                                        <option value="transfer">Savings/Investing</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddSubcategory(category.id, newSubcategoryName, newSubcategoryType)}
                                                        className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-500"
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddingSubcategoryTo(null);
                                                            setNewSubcategoryName('');
                                                        }}
                                                        className="px-3 py-1 rounded-md bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Convert to Subcategory Form */}
                                        {isConverting && (
                                            <div className="ml-8 p-3 rounded-md bg-slate-950 border border-slate-700 space-y-2">
                                                <select
                                                    value={targetParentId}
                                                    onChange={e => setTargetParentId(e.target.value)}
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                                >
                                                    <option value="">Select parent category...</option>
                                                    {potentialParents
                                                        .filter(p => p.id !== category.id && (p.kind === 'group' || !p.parent_id))
                                                        .map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.type === 'income' ? '⬆️' : p.type === 'transfer' ? '💰' : '⬇️'} {p.name}
                                                            </option>
                                                        ))}
                                                </select>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleConvertToSubcategory(category.id, targetParentId)}
                                                        className="flex-1 px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500"
                                                    >
                                                        Convert
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setConvertingCategory(null);
                                                            setTargetParentId('');
                                                        }}
                                                        className="flex-1 px-3 py-1 rounded-md bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Change Type Form */}
                                        {editingCategoryTypes[category.id] !== undefined && (
                                            <div className="ml-8 p-3 rounded-md bg-slate-950 border border-slate-700 space-y-2">
                                                <label className="text-xs text-slate-400">Category Type</label>
                                                <select
                                                    value={editingCategoryTypes[category.id]}
                                                    onChange={e => setEditingCategoryTypes(prev => ({
                                                        ...prev,
                                                        [category.id]: e.target.value as 'income' | 'expense' | 'transfer'
                                                    }))}
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                                >
                                                    <option value="expense">⬇️ Expense</option>
                                                    <option value="income">⬆️ Income</option>
                                                    <option value="transfer">💰 Savings/Investing</option>
                                                </select>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newType = editingCategoryTypes[category.id];
                                                            handleUpdateCategoryType(category.id, newType);
                                                            setEditingCategoryTypes(prev => {
                                                                const next = { ...prev };
                                                                delete next[category.id];
                                                                return next;
                                                            });
                                                        }}
                                                        className="flex-1 px-3 py-1 rounded-md bg-purple-600 text-white text-sm hover:bg-purple-500"
                                                    >
                                                        Update
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingCategoryTypes(prev => {
                                                                const next = { ...prev };
                                                                delete next[category.id];
                                                                return next;
                                                            });
                                                        }}
                                                        className="flex-1 px-3 py-1 rounded-md bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Editing Name */}
                                        {editingCategoryNames[category.id] !== undefined && (
                                            <div className="ml-8 p-2 rounded-md bg-slate-950 border border-slate-700">
                                                <input
                                                    type="text"
                                                    value={editingCategoryNames[category.id]}
                                                    onChange={e => setEditingCategoryNames(prev => ({
                                                        ...prev,
                                                        [category.id]: e.target.value
                                                    }))}
                                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                                    autoFocus
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            handleUpdateCategoryName(category.id, editingCategoryNames[category.id]);
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEditCategoryName(category.id);
                                                        }
                                                    }}
                                                    onBlur={() => handleUpdateCategoryName(category.id, editingCategoryNames[category.id])}
                                                />
                                            </div>
                                        )}
                                        
                                        {/* Children */}
                                        {hasChildren && isExpanded && (
                                            <div className="ml-4 space-y-1">
                                                {children.map(child => {
                                                    const isChildRenaming = editingCategoryNames[child.id] !== undefined;
                                                    const isChildMoving = convertingCategory === child.id;
                                                    
                                                    return (
                                                        <div key={child.id} className="space-y-1">
                                                            <div className="flex items-center gap-2 p-2 rounded-md bg-slate-950 hover:bg-slate-900 ml-6">
                                                                <div className="w-4" />
                                                                <div className="flex-1 flex items-center gap-2">
                                                                    <span className="text-sm text-slate-300">
                                                                        └─ {child.name}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleStartEditCategoryName(child.id, child.name)}
                                                                        className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                                    >
                                                                        Rename
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setConvertingCategory(child.id);
                                                                            setTargetParentId(child.parent_id || '');
                                                                        }}
                                                                        className="text-[10px] px-2 py-1 rounded bg-blue-900 text-blue-200 hover:bg-blue-800"
                                                                    >
                                                                        Move
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteCategory(child.id, child.name, false)}
                                                                        className="text-[10px] px-2 py-1 rounded bg-red-900 text-red-200 hover:bg-red-800"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Rename input for child */}
                                                            {isChildRenaming && (
                                                                <div className="ml-12 p-2 rounded-md bg-slate-950 border border-slate-700">
                                                                    <input
                                                                        type="text"
                                                                        value={editingCategoryNames[child.id]}
                                                                        onChange={e => setEditingCategoryNames(prev => ({
                                                                            ...prev,
                                                                            [child.id]: e.target.value
                                                                        }))}
                                                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                                                        autoFocus
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') {
                                                                                handleUpdateCategoryName(child.id, editingCategoryNames[child.id]);
                                                                            } else if (e.key === 'Escape') {
                                                                                handleCancelEditCategoryName(child.id);
                                                                            }
                                                                        }}
                                                                        onBlur={() => handleUpdateCategoryName(child.id, editingCategoryNames[child.id])}
                                                                    />
                                                                </div>
                                                            )}
                                                            
                                                            {/* Move form for child */}
                                                            {isChildMoving && (
                                                                <div className="ml-12 p-3 rounded-md bg-slate-950 border border-slate-700 space-y-2">
                                                                    <select
                                                                        value={targetParentId}
                                                                        onChange={e => setTargetParentId(e.target.value)}
                                                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                                                    >
                                                                        <option value="">Select parent category...</option>
                                                                        {potentialParents
                                                                            .filter(p => p.id !== child.id && (p.kind === 'group' || !p.parent_id))
                                                                            .map(p => (
                                                                                <option key={p.id} value={p.id}>
                                                                                    {p.type === 'income' ? '⬆️' : p.type === 'transfer' ? '💰' : '⬇️'} {p.name}
                                                                                </option>
                                                                            ))}
                                                                    </select>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleConvertToSubcategory(child.id, targetParentId)}
                                                                            className="flex-1 px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500"
                                                                        >
                                                                            Move
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setConvertingCategory(null);
                                                                                setTargetParentId('');
                                                                            }}
                                                                            className="flex-1 px-3 py-1 rounded-md bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
