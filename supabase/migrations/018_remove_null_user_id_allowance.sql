-- Migration: Remove NULL user_id allowance from RLS policies
-- Run this AFTER migration 017 to secure the finance tables
-- This removes the temporary NULL allowance that was added for data recovery

-- Step 1: Update accounts RLS policy
DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
CREATE POLICY "Users can view their own accounts"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id);

-- Step 2: Update transactions RLS policy
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Step 3: Update categories RLS policy
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view their own categories"
    ON categories FOR SELECT
    USING (auth.uid() = user_id);

-- Step 4: Update category_budgets RLS policy
DROP POLICY IF EXISTS "Users can view their own category_budgets" ON category_budgets;
CREATE POLICY "Users can view their own category_budgets"
    ON category_budgets FOR SELECT
    USING (auth.uid() = user_id);

-- Step 5: Optional - Delete any remaining orphaned data (NULL user_id)
-- Uncomment these if you want to clean up any data that wasn't assigned to a user
-- DELETE FROM category_budgets WHERE user_id IS NULL;
-- DELETE FROM transactions WHERE user_id IS NULL;
-- DELETE FROM accounts WHERE user_id IS NULL;
-- DELETE FROM categories WHERE user_id IS NULL;









