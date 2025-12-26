-- Migration: Assign user_id to existing finance data
-- This migration helps recover data that was created before user_id columns existed
-- 
-- IMPORTANT: This assigns ALL NULL user_id rows to the FIRST user in auth.users
-- If you have multiple users and need to assign data to specific users, you'll need
-- to manually update the user_id values based on your business logic.
--
-- To use this migration:
-- 1. Identify which user should own the existing data
-- 2. Replace 'FIRST_USER_ID' below with that user's UUID
-- 3. Or modify the query to use a different assignment strategy

-- Step 1: Get the first user ID (or modify to use a specific user)
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    -- Get the first user (oldest account) - modify this logic as needed
    SELECT id INTO first_user_id 
    FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- If no users exist, skip the update
    IF first_user_id IS NULL THEN
        RAISE NOTICE 'No users found in auth.users. Skipping user_id assignment.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Assigning NULL user_id rows to user: %', first_user_id;
    
    -- Step 2: Assign user_id to accounts
    UPDATE accounts 
    SET user_id = first_user_id 
    WHERE user_id IS NULL;
    
    RAISE NOTICE 'Updated % accounts', (SELECT COUNT(*) FROM accounts WHERE user_id = first_user_id);
    
    -- Step 3: Assign user_id to transactions
    UPDATE transactions 
    SET user_id = first_user_id 
    WHERE user_id IS NULL;
    
    RAISE NOTICE 'Updated % transactions', (SELECT COUNT(*) FROM transactions WHERE user_id = first_user_id);
    
    -- Step 4: Assign user_id to categories
    UPDATE categories 
    SET user_id = first_user_id 
    WHERE user_id IS NULL;
    
    RAISE NOTICE 'Updated % categories', (SELECT COUNT(*) FROM categories WHERE user_id = first_user_id);
    
    -- Step 5: Assign user_id to category_budgets
    UPDATE category_budgets 
    SET user_id = first_user_id 
    WHERE user_id IS NULL;
    
    RAISE NOTICE 'Updated % category_budgets', (SELECT COUNT(*) FROM category_budgets WHERE user_id = first_user_id);
    
    RAISE NOTICE 'Data recovery complete. All NULL user_id rows have been assigned to user: %', first_user_id;
END $$;

-- Step 6: After running this migration, you should update RLS policies to remove NULL allowance
-- Run these commands manually after verifying the data assignment:
--
-- DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
-- CREATE POLICY "Users can view their own accounts" ON accounts FOR SELECT USING (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
-- CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
-- CREATE POLICY "Users can view their own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS "Users can view their own category_budgets" ON category_budgets;
-- CREATE POLICY "Users can view their own category_budgets" ON category_budgets FOR SELECT USING (auth.uid() = user_id);

