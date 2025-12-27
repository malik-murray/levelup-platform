-- Migration: Add user_id columns to finance tables and enable RLS
-- This ensures data isolation between users - CRITICAL SECURITY FIX

-- Step 1: Add user_id to accounts table
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Add user_id to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Add user_id to categories table
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Add user_id to category_budgets table
ALTER TABLE category_budgets
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_id ON category_budgets(user_id);

-- Step 6: Enable Row Level Security on all finance tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for accounts table
-- Users can only see their own accounts
-- NOTE: Temporarily allow NULL user_id for backward compatibility with existing data
-- After assigning user_ids to existing rows, you should update this policy to remove the NULL check
CREATE POLICY "Users can view their own accounts"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own accounts
CREATE POLICY "Users can insert their own accounts"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own accounts
CREATE POLICY "Users can update their own accounts"
    ON accounts FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own accounts
CREATE POLICY "Users can delete their own accounts"
    ON accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Step 8: Create RLS policies for transactions table
-- Users can only see their own transactions
-- NOTE: Temporarily allow NULL user_id for backward compatibility with existing data
-- After assigning user_ids to existing rows, you should update this policy to remove the NULL check
CREATE POLICY "Users can view their own transactions"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own transactions
CREATE POLICY "Users can insert their own transactions"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own transactions
CREATE POLICY "Users can update their own transactions"
    ON transactions FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own transactions
CREATE POLICY "Users can delete their own transactions"
    ON transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Step 9: Create RLS policies for categories table
-- Users can only see their own categories
-- NOTE: Temporarily allow NULL user_id for backward compatibility with existing data
-- After assigning user_ids to existing rows, you should update this policy to remove the NULL check
CREATE POLICY "Users can view their own categories"
    ON categories FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own categories
CREATE POLICY "Users can insert their own categories"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own categories
CREATE POLICY "Users can update their own categories"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own categories
CREATE POLICY "Users can delete their own categories"
    ON categories FOR DELETE
    USING (auth.uid() = user_id);

-- Step 10: Create RLS policies for category_budgets table
-- Users can only see their own budgets
-- NOTE: Temporarily allow NULL user_id for backward compatibility with existing data
-- After assigning user_ids to existing rows, you should update this policy to remove the NULL check
CREATE POLICY "Users can view their own category_budgets"
    ON category_budgets FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own budgets
CREATE POLICY "Users can insert their own category_budgets"
    ON category_budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own budgets
CREATE POLICY "Users can update their own category_budgets"
    ON category_budgets FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own budgets
CREATE POLICY "Users can delete their own category_budgets"
    ON category_budgets FOR DELETE
    USING (auth.uid() = user_id);

-- Step 11: Make user_id NOT NULL after setting defaults (if needed)
-- Note: For existing data, you may need to assign user_id values manually
-- This migration adds the column as nullable first to avoid breaking existing data
-- You should update existing rows with appropriate user_id values before making it NOT NULL

-- IMPORTANT: Data Recovery Instructions
-- If you have existing finance data with NULL user_id values, you need to assign them:
-- 
-- Option 1: Assign all NULL user_id rows to a specific user (if you know which user created them)
-- UPDATE accounts SET user_id = 'USER_UUID_HERE' WHERE user_id IS NULL;
-- UPDATE transactions SET user_id = 'USER_UUID_HERE' WHERE user_id IS NULL;
-- UPDATE categories SET user_id = 'USER_UUID_HERE' WHERE user_id IS NULL;
-- UPDATE category_budgets SET user_id = 'USER_UUID_HERE' WHERE user_id IS NULL;
--
-- Option 2: After assigning user_ids, update RLS policies to remove NULL allowance:
-- DROP POLICY "Users can view their own accounts" ON accounts;
-- CREATE POLICY "Users can view their own accounts" ON accounts FOR SELECT USING (auth.uid() = user_id);
-- (Repeat for transactions, categories, category_budgets)
--
-- Option 3: If you want to delete orphaned data (NULL user_id):
-- DELETE FROM category_budgets WHERE user_id IS NULL;
-- DELETE FROM transactions WHERE user_id IS NULL;
-- DELETE FROM accounts WHERE user_id IS NULL;
-- DELETE FROM categories WHERE user_id IS NULL;





