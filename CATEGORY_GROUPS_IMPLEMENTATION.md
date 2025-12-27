# Category Groups + Subcategory Budget View Implementation

## Summary

This implementation adds a YNAB-style category group + subcategory budget view with collapsible sections, 3-column layout (Assigned / Activity / Available), and progress bars.

## Key Changes

### 1. Database Migration (`supabase/migrations/001_add_category_groups.sql`)
- Adds `kind` column to `categories` table (`'group'` or `'category'`)
- Adds `parent_id` column to `categories` table (UUID, nullable)
- Migrates existing `sub_categories` data into `categories` table
- Updates parent categories to `kind='group'` if they have subcategories
- Deletes any budgets attached to group categories (safeguard)
- Creates indexes for performance
- **Note**: The `sub_categories` table drop is commented out - uncomment after verifying migration

### 2. TypeScript Types (`src/lib/types.ts`)
- New `Category` type with `kind: 'group' | 'category'` and `parent_id: string | null`
- New `BudgetCategoryRow` type for individual category budget rows
- New `BudgetGroup` type for grouped category display
- New `BudgetSummary` type for month-level totals

### 3. Budget Groups Helper (`src/lib/budgetGroups.ts`)
- `getBudgetGroupsForMonth()`: Fetches categories, budgets, and transactions, returns grouped structure
- `getBudgetSummaryForMonth()`: Calculates month-level totals
- `saveCategoryBudget()`: Saves/updates budget with safeguard against group budgets
- `deleteCategoryBudget()`: Deletes a budget
- Includes safeguards to warn if budgets are attached to group categories
- Activity calculation respects expense (negative) vs income (positive) conventions

### 4. Budget Page (`src/app/finance/budget/page.tsx`)
- Complete rewrite with YNAB-style layout:
  - **Summary Section**: Shows "Ready to Assign" with totalAssigned, totalActivity, totalAvailable
  - **3-Column Layout**: Assigned / Activity / Available for each row
  - **Collapsible Groups**: Click group row to expand/collapse subcategories
  - **Progress Bars**: Visual indicators on each row showing activity vs assigned
  - **Inline Editing**: Click "Assigned" amount to edit budget inline
  - **Real-time Updates**: Group totals recompute automatically after budget changes
- Category creation form supports creating groups or categories
- Only subcategories can have budgets (groups are display-only)

### 5. Unit Tests (`src/lib/__tests__/budgetGroups.test.ts`)
- Tests group totals consistency (totals = sum of children)
- Tests edge cases (empty groups, negative available amounts)

## Data Model

```
Category {
  id: string
  name: string
  kind: 'group' | 'category'  // NEW
  parent_id: string | null    // NEW (null for groups, group id for categories)
  type: 'income' | 'expense' | 'transfer' | null
}

category_budgets {
  category_id: string  // Must reference kind='category' only
  month: string        // Format: YYYY-MM
  amount: number
}
```

## Usage

1. **Run the migration** in your Supabase dashboard:
   ```sql
   -- Execute the contents of supabase/migrations/001_add_category_groups.sql
   ```

2. **Create categories**:
   - Create a **Group** (e.g., "Subscriptions") with `kind='group'`
   - Create **Categories** under that group (e.g., "Netflix", "Spotify") with `kind='category'` and `parent_id` set to the group's id

3. **Set budgets**:
   - Budgets can only be set on categories (subcategories), not groups
   - Group totals are automatically calculated as the sum of their children

## Features

✅ Collapsible category groups (YNAB-style)
✅ 3-column layout: Assigned / Activity / Available
✅ Progress bars on each row
✅ Inline budget editing
✅ Real-time group total updates
✅ Budget summary at top ("Ready to Assign")
✅ Safeguards prevent budgets on groups
✅ Consistent with existing transaction/budget tables

## Notes

- The migration preserves existing data by migrating `sub_categories` into `categories`
- Old code that queries `categories` only will continue to work (they just won't see `kind`/`parent_id` fields)
- Activity calculation uses absolute values for expenses (negative amounts) and positive values for income













