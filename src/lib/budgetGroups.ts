/**
 * Helper functions for fetching and organizing budget groups
 */

import { supabase } from '@auth/supabaseClient';
import type { Category, CategoryBudget, Transaction, BudgetGroup, BudgetCategoryRow, BudgetSummary } from './types';

/**
 * Fetches categories, budgets, and transactions for a given month and returns grouped structure
 */
export async function getBudgetGroupsForMonth(
    monthStr: string // Format: YYYY-MM
): Promise<BudgetGroup[]> {
    // Calculate date range for the month
    const [year, month] = monthStr.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);
    
    const startStr = startOfMonth.toISOString().slice(0, 10);
    const endStr = endOfMonth.toISOString().slice(0, 10);

    // Fetch all categories
    // Note: sort_order might not exist if migration hasn't run yet, so we try to select it but handle gracefully
    let categoriesData: any[] | null = null;
    let categoriesError: any = null;
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User must be authenticated to fetch budget data');
    }

    // First try with sort_order
    const result = await supabase
        .from('categories')
        .select('id, name, kind, parent_id, type, sort_order')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
    
    categoriesData = result.data;
    categoriesError = result.error;
    
    // If error occurs (could be because sort_order column doesn't exist), retry without it
    if (categoriesError) {
        console.log('Error fetching with sort_order, retrying without it...', {
            error: categoriesError,
            message: categoriesError?.message,
            code: categoriesError?.code,
            details: categoriesError?.details,
            hint: categoriesError?.hint
        });
        const retryResult = await supabase
            .from('categories')
            .select('id, name, kind, parent_id, type')
            .eq('user_id', user.id)
            .order('name', { ascending: true });
        
        categoriesData = retryResult.data;
        categoriesError = retryResult.error;
        
        // Add default sort_order to each category (using index as order)
        if (categoriesData && !categoriesError) {
            categoriesData = categoriesData.map((cat, index) => ({
                ...cat,
                sort_order: index
            }));
        }
    }

    if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        const errorMsg = categoriesError.message || JSON.stringify(categoriesError) || 'Unknown error';
        throw new Error(`Failed to fetch categories: ${errorMsg}`);
    }
    
    if (!categoriesData) {
        throw new Error('Failed to fetch categories: No data returned');
    }

    // Sort by sort_order if it exists, otherwise by name
    const sortedCategories = [...categoriesData].sort((a, b) => {
        const orderA = (a as any).sort_order ?? 999999;
        const orderB = (b as any).sort_order ?? 999999;
        if (orderA !== orderB && orderA !== 999999 && orderB !== 999999) {
            return orderA - orderB;
        }
        return (a.name || '').localeCompare(b.name || '');
    });
    
    const categories = (sortedCategories as Category[]) ?? [];

    // Fetch budgets for the month
    const { data: budgetsData, error: budgetsError } = await supabase
        .from('category_budgets')
        .select('id, category_id, month, amount')
        .eq('user_id', user.id)
        .eq('month', monthStr);

    if (budgetsError) {
        console.error('Error fetching budgets:', budgetsError);
        throw new Error(`Failed to fetch budgets: ${budgetsError.message}`);
    }

    const budgets = (budgetsData as CategoryBudget[]) ?? [];

    // Safeguard: Check if any budgets reference group categories
    const groupCategoryIds = new Set(
        categories.filter(c => c.kind === 'group').map(c => c.id)
    );
    const invalidBudgets = budgets.filter(b => groupCategoryIds.has(b.category_id));
    if (invalidBudgets.length > 0) {
        console.warn(
            `Warning: Found ${invalidBudgets.length} budgets attached to group categories. ` +
            `These should not exist. Category IDs: ${invalidBudgets.map(b => b.category_id).join(', ')}`
        );
    }

    // Fetch transactions for the month
    const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('id, date, amount, category_id')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .lt('date', endStr);

    if (transactionsError) {
        console.error('Error fetching transactions:', transactionsError);
        throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
    }

    const transactions = ((transactionsData as Transaction[]) ?? []).map(tx => ({
        ...tx,
        amount: Number(tx.amount),
    }));

    // Build maps for quick lookup
    const budgetsByCategoryId = new Map<string, number>();
    budgets.forEach(b => {
        budgetsByCategoryId.set(b.category_id, b.amount);
    });

    // Calculate activity per category
    // Activity should be positive for both expenses (spent) and income (earned)
    // Convention: expenses are negative amounts, income are positive amounts
    const activityByCategoryId = new Map<string, number>();
    transactions.forEach(tx => {
        if (!tx.category_id) return;
        
        const current = activityByCategoryId.get(tx.category_id) || 0;
        const category = categories.find(c => c.id === tx.category_id);
        
        if (category) {
            if (category.type === 'expense') {
                // For expenses, negative amounts represent spending
                // Activity = absolute value of negative amounts (money spent)
                activityByCategoryId.set(tx.category_id, current + Math.abs(Math.min(0, tx.amount)));
            } else if (category.type === 'income') {
                // For income, positive amounts represent earnings
                // Activity = positive amounts (money earned)
                activityByCategoryId.set(tx.category_id, current + Math.max(0, tx.amount));
            } else {
                // For transfers or unknown, use absolute value
                activityByCategoryId.set(tx.category_id, current + Math.abs(tx.amount));
            }
        } else {
            // If category not found, check amount sign:
            // Negative = expense (use absolute), Positive = income (use as-is)
            if (tx.amount < 0) {
                activityByCategoryId.set(tx.category_id, current + Math.abs(tx.amount));
            } else {
                activityByCategoryId.set(tx.category_id, current + tx.amount);
            }
        }
    });

    // Separate groups and categories
    const groups = categories.filter(c => c.kind === 'group');
    const categoryItems = categories.filter(c => c.kind === 'category');
    
    // Separate categories by whether they have a parent (belong to a group) or are standalone
    const groupedCategories = categoryItems.filter(c => c.parent_id !== null);
    const standaloneCategories = categoryItems.filter(c => c.parent_id === null);

    // Build BudgetGroup array from actual groups
    const budgetGroups: BudgetGroup[] = groups.map(group => {
        // Find all categories that belong to this group
        const groupCategories = groupedCategories.filter(c => c.parent_id === group.id);

        // Build BudgetCategoryRow array for this group's categories
        const categoryRows: BudgetCategoryRow[] = groupCategories.map(cat => {
            const rawAssigned = budgetsByCategoryId.get(cat.id) || 0;
            const activity = activityByCategoryId.get(cat.id) || 0;
            
            // For expenses, assigned is stored as negative, but we need to calculate available correctly
            // Available = |assigned| - activity (for expenses)
            // Available = assigned - activity (for income, where assigned is positive)
            let assigned: number;
            let available: number;
            
            if (group.type === 'expense') {
                // For expenses: assigned is stored as negative, but we calculate using absolute value
                // Example: budget -$950, spent $950 → available = 950 - 950 = 0
                assigned = rawAssigned; // Keep as negative for storage consistency
                const assignedAbs = Math.abs(rawAssigned);
                available = assignedAbs - activity;
            } else if (group.type === 'income') {
                // For income: assigned is positive, activity is positive
                // Example: budget $1000, earned $500 → available = 1000 - 500 = 500
                assigned = rawAssigned;
                available = assigned - activity;
            } else {
                // For transfers or unknown: use absolute values
                assigned = rawAssigned;
                available = Math.abs(assigned) - activity;
            }

            return {
                id: cat.id,
                name: cat.name,
                assigned,
                activity,
                available,
            };
        });

        // Calculate group totals
        // For expenses, we need to sum absolute values of assigned for totals
        // For income, we sum positive values
        const totalAssigned = categoryRows.reduce((sum, row) => {
            if (group.type === 'expense') {
                // For expenses, assigned is negative, but we want to show positive total
                return sum + Math.abs(row.assigned);
            } else {
                // For income, assigned is positive
                return sum + row.assigned;
            }
        }, 0);
        const totalActivity = categoryRows.reduce((sum, row) => sum + row.activity, 0);
        const totalAvailable = totalAssigned - totalActivity;

        return {
            id: group.id,
            name: group.name,
            categories: categoryRows.sort((a, b) => {
                // Find the category objects to check sort_order
                const catA = groupCategories.find(c => c.id === a.id);
                const catB = groupCategories.find(c => c.id === b.id);
                const orderA = catA?.sort_order ?? 999999;
                const orderB = catB?.sort_order ?? 999999;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name); // Fallback to name sorting
            }),
            totalAssigned,
            totalActivity,
            totalAvailable,
            type: group.type,
            sort_order: group.sort_order ?? 999999,
        };
    });
    
    // Create virtual groups for standalone categories (grouped by type)
    const standaloneByType = new Map<string, Category[]>();
    standaloneCategories.forEach(cat => {
        const type = cat.type || 'other';
        if (!standaloneByType.has(type)) {
            standaloneByType.set(type, []);
        }
        standaloneByType.get(type)!.push(cat);
    });
    
    // Add virtual groups for standalone categories
    standaloneByType.forEach((cats, type) => {
        const categoryRows: BudgetCategoryRow[] = cats.map(cat => {
            const rawAssigned = budgetsByCategoryId.get(cat.id) || 0;
            const activity = activityByCategoryId.get(cat.id) || 0;
            
            let assigned: number;
            let available: number;
            
            if (type === 'expense') {
                assigned = rawAssigned;
                const assignedAbs = Math.abs(rawAssigned);
                available = assignedAbs - activity;
            } else if (type === 'income') {
                assigned = rawAssigned;
                available = assigned - activity;
            } else {
                assigned = rawAssigned;
                available = Math.abs(assigned) - activity;
            }

            return {
                id: cat.id,
                name: cat.name,
                assigned,
                activity,
                available,
            };
        });
        
        const totalAssigned = categoryRows.reduce((sum, row) => {
            if (type === 'expense') {
                return sum + Math.abs(row.assigned);
            } else {
                return sum + row.assigned;
            }
        }, 0);
        const totalActivity = categoryRows.reduce((sum, row) => sum + row.activity, 0);
        const totalAvailable = totalAssigned - totalActivity;
        
        // Create a virtual group for standalone categories
        // Use a special ID format to distinguish from real groups
        const virtualGroupId = `__standalone_${type}`;
        budgetGroups.push({
            id: virtualGroupId,
            name: type === 'income' ? '⬆️ Standalone Income Categories' 
                 : type === 'expense' ? '⬇️ Standalone Expense Categories'
                 : type === 'transfer' ? '💱 Standalone Transfer Categories'
                 : '📋 Standalone Categories',
            categories: categoryRows.sort((a, b) => {
                const catA = cats.find(c => c.id === a.id);
                const catB = cats.find(c => c.id === b.id);
                const orderA = catA?.sort_order ?? 999999;
                const orderB = catB?.sort_order ?? 999999;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            }),
            totalAssigned,
            totalActivity,
            totalAvailable,
            type: type as 'income' | 'expense' | 'transfer' | null,
            sort_order: 999998, // Put standalone categories at the end
        });
    });

    // Sort groups by sort_order, then by name
    return budgetGroups.sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name); // Fallback to name sorting
    });
}

/**
 * Calculates budget summary for all categories in a given month
 */
export async function getBudgetSummaryForMonth(
    monthStr: string
): Promise<BudgetSummary> {
    const groups = await getBudgetGroupsForMonth(monthStr);

    const totalAssigned = groups.reduce((sum, group) => sum + group.totalAssigned, 0);
    const totalActivity = groups.reduce((sum, group) => sum + group.totalActivity, 0);
    const totalAvailable = totalAssigned - totalActivity;

    return {
        totalAssigned,
        totalActivity,
        totalAvailable,
    };
}

/**
 * Helper to save or update a budget for a category
 * Throws an error if trying to save a budget on a group category
 */
export async function saveCategoryBudget(
    categoryId: string,
    monthStr: string,
    amount: number
): Promise<void> {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User must be authenticated to save budgets');
    }

    // First, verify this is not a group category
    const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, kind')
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .single();

    if (categoryError) {
        throw new Error(`Failed to fetch category: ${categoryError.message}`);
    }

    if (!categoryData) {
        throw new Error(`Category not found: ${categoryId}`);
    }

    if ((categoryData as Category).kind === 'group') {
        throw new Error('Cannot assign budget to a group category. Budgets can only be assigned to subcategories.');
    }

    // Check if budget exists
    const { data: existing, error: fetchError } = await supabase
        .from('category_budgets')
        .select('id')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('month', monthStr)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
        throw new Error(`Failed to check existing budget: ${fetchError.message}`);
    }

    if (existing) {
        // Update existing
        const { error: updateError } = await supabase
            .from('category_budgets')
            .update({ amount })
            .eq('id', existing.id)
            .eq('user_id', user.id);

        if (updateError) {
            throw new Error(`Failed to update budget: ${updateError.message}`);
        }
    } else {
        // Insert new
        const { error: insertError } = await supabase
            .from('category_budgets')
            .insert({
                category_id: categoryId,
                month: monthStr,
                amount,
                user_id: user.id,
            });

        if (insertError) {
            throw new Error(`Failed to create budget: ${insertError.message}`);
        }
    }
}

/**
 * Helper to delete a budget for a category
 */
export async function deleteCategoryBudget(
    categoryId: string,
    monthStr: string
): Promise<void> {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User must be authenticated to delete budgets');
    }

    const { error } = await supabase
        .from('category_budgets')
        .delete()
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('month', monthStr);

    if (error) {
        throw new Error(`Failed to delete budget: ${error.message}`);
    }
}

/**
 * Helper to duplicate all budgets from one month to another
 * Copies all category budgets from sourceMonth to targetMonth
 */
export async function duplicateBudgets(
    sourceMonthStr: string, // Format: YYYY-MM
    targetMonthStr: string  // Format: YYYY-MM
): Promise<number> {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User must be authenticated to duplicate budgets');
    }

    if (sourceMonthStr === targetMonthStr) {
        throw new Error('Source and target months cannot be the same.');
    }

    // Fetch all budgets from source month
    const { data: sourceBudgets, error: fetchError } = await supabase
        .from('category_budgets')
        .select('category_id, amount')
        .eq('user_id', user.id)
        .eq('month', sourceMonthStr);

    if (fetchError) {
        throw new Error(`Failed to fetch source budgets: ${fetchError.message}`);
    }

    if (!sourceBudgets || sourceBudgets.length === 0) {
        throw new Error(`No budgets found for ${sourceMonthStr} to copy.`);
    }

    // Verify all categories exist and are not groups
    const categoryIds = sourceBudgets.map(b => b.category_id);
    const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('id, kind')
        .eq('user_id', user.id)
        .in('id', categoryIds);

    if (categoriesError) {
        throw new Error(`Failed to verify categories: ${categoriesError.message}`);
    }

    // Filter out any group categories (shouldn't exist, but safety check)
    const validCategoryIds = new Set(
        (categories as Category[]).filter(c => c.kind === 'category').map(c => c.id)
    );
    const validBudgets = sourceBudgets.filter(b => validCategoryIds.has(b.category_id));

    if (validBudgets.length === 0) {
        throw new Error('No valid budgets to copy (all are group categories).');
    }

    // Check for existing budgets in target month and get them
    const { data: existingBudgets, error: existingError } = await supabase
        .from('category_budgets')
        .select('category_id')
        .eq('user_id', user.id)
        .eq('month', targetMonthStr);

    if (existingError) {
        throw new Error(`Failed to check existing budgets: ${existingError.message}`);
    }

    const existingCategoryIds = new Set(
        (existingBudgets || []).map((b: any) => b.category_id)
    );

    // Prepare budgets to insert (only new ones or updates)
    const budgetsToInsert = validBudgets.map(b => ({
        category_id: b.category_id,
        month: targetMonthStr,
        amount: b.amount,
        user_id: user.id,
    }));

    // For budgets that already exist, update them instead
    const budgetsToUpdate = budgetsToInsert.filter(b => existingCategoryIds.has(b.category_id));
    const budgetsToInsertNew = budgetsToInsert.filter(b => !existingCategoryIds.has(b.category_id));

    let updatedCount = 0;
    let insertedCount = 0;

    // Update existing budgets
    for (const budget of budgetsToUpdate) {
        const { error: updateError } = await supabase
            .from('category_budgets')
            .update({ amount: budget.amount })
            .eq('user_id', user.id)
            .eq('category_id', budget.category_id)
            .eq('month', targetMonthStr);

        if (updateError) {
            console.error(`Error updating budget for category ${budget.category_id}:`, updateError);
            // Continue with others
        } else {
            updatedCount++;
        }
    }

    // Insert new budgets
    if (budgetsToInsertNew.length > 0) {
        const { error: insertError } = await supabase
            .from('category_budgets')
            .insert(budgetsToInsertNew);

        if (insertError) {
            throw new Error(`Failed to insert budgets: ${insertError.message}`);
        }
        insertedCount = budgetsToInsertNew.length;
    }

    return insertedCount + updatedCount;
}

/**
 * Helper to get the next month string
 */
export function getNextMonthStr(monthStr: string): string {
    const [year, month] = monthStr.split('-').map(Number);
    // month is 1-indexed in the string (1-12), but Date constructor expects 0-indexed (0-11)
    const currentDate = new Date(year, month - 1, 1);
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const nextYear = nextMonth.getFullYear();
    const nextMonthNum = nextMonth.getMonth() + 1;
    return `${nextYear}-${String(nextMonthNum).padStart(2, '0')}`;
}

/**
 * Update the sort_order for a category
 */
export async function updateCategorySortOrder(
    categoryId: string,
    sortOrder: number
): Promise<void> {
    const { error } = await supabase
        .from('categories')
        .update({ sort_order: sortOrder })
        .eq('id', categoryId);

    if (error) {
        throw new Error(`Failed to update sort order: ${error.message}`);
    }
}

/**
 * Reorder categories by updating multiple sort_order values at once
 */
export async function reorderCategories(
    categoryIds: string[]
): Promise<void> {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User must be authenticated to reorder categories');
    }

    // Update all categories with their new sort_order
    const updates = categoryIds.map((id, index) => ({
        id,
        sort_order: index,
    }));

    // Batch update using upsert
    for (const update of updates) {
        const { error } = await supabase
            .from('categories')
            .update({ sort_order: update.sort_order })
            .eq('id', update.id)
            .eq('user_id', user.id); // Ensure user can only update their own categories

        if (error) {
            throw new Error(`Failed to update sort order for category ${update.id}: ${error.message}`);
        }
    }
}

