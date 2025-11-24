/**
 * Shared TypeScript types for the finance module
 */

export type Category = {
    id: string;
    name: string;
    // 'group' = a top-level category row (Subscriptions, Income, etc.)
    // 'category' = a budgetable line item (Softr, Canva, DoorDash, etc.)
    kind: 'group' | 'category';
    parent_id: string | null; // null for groups, group id for subcategories
    type: 'income' | 'expense' | 'transfer' | null; // keep whatever we already use
    sort_order?: number; // For custom ordering of categories/groups
};

export type CategoryBudget = {
    id: string;
    category_id: string; // Must reference a kind='category' item
    month: string; // Format: YYYY-MM
    amount: number;
};

export type Transaction = {
    id: string;
    date: string; // ISO format: YYYY-MM-DD
    amount: number; // positive for inflow, negative for outflow
    category_id: string | null; // Can reference either group or category, but activity is typically on categories
};

/**
 * Budget row for a single category (subcategory)
 */
export type BudgetCategoryRow = {
    id: string;
    name: string;
    assigned: number; // budget amount
    activity: number; // sum of transaction amounts
    available: number; // assigned - activity
};

/**
 * Budget group containing multiple categories
 */
export type BudgetGroup = {
    id: string;
    name: string;
    categories: BudgetCategoryRow[];
    // group totals (computed as sum of children)
    totalAssigned: number;
    totalActivity: number;
    totalAvailable: number;
    type: 'income' | 'expense' | 'transfer' | null;
    sort_order?: number; // For custom ordering
};

/**
 * Budget summary for the entire month
 */
export type BudgetSummary = {
    totalAssigned: number; // sum of all subcategory assigned
    totalActivity: number; // sum of all activity
    totalAvailable: number; // money left for the month
};


