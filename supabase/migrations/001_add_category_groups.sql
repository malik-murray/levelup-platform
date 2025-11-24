-- Migration: Add category groups and subcategories support
-- This migration consolidates sub_categories into categories with kind and parent_id fields

-- Step 1: Add kind and parent_id columns to categories table (if they don't exist)
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS kind TEXT CHECK (kind IN ('group', 'category')) DEFAULT 'category',
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Step 2: Migrate sub_categories data into categories
-- First, set all existing categories to kind='category' if null
UPDATE categories SET kind = 'category' WHERE kind IS NULL;

-- Step 3: Create groups from parent categories that have subcategories
-- For each parent category that has subcategories, ensure it's marked as kind='group'
DO $$
DECLARE
    parent_cat RECORD;
BEGIN
    FOR parent_cat IN 
        SELECT DISTINCT category_id 
        FROM sub_categories 
        WHERE category_id IS NOT NULL
    LOOP
        -- Update parent to be a group if it exists
        UPDATE categories 
        SET kind = 'group' 
        WHERE id = parent_cat.category_id 
        AND (kind IS NULL OR kind != 'group');
    END LOOP;
END $$;

-- Step 4: Migrate sub_categories into categories with parent_id set
-- First, update existing categories that match sub_categories by ID
UPDATE categories c
SET 
    kind = 'category',
    parent_id = sc.category_id
FROM sub_categories sc
WHERE c.id = sc.id;

-- Then insert any new sub_categories that don't exist in categories yet
INSERT INTO categories (id, name, type, kind, parent_id)
SELECT 
    sc.id,
    sc.name,
    sc.type,
    'category' AS kind,
    sc.category_id AS parent_id
FROM sub_categories sc
WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.id = sc.id
);

-- Step 5: Update category_budgets to only reference kind='category' items
-- Delete any budgets that reference group categories (this is a safeguard)
DELETE FROM category_budgets
WHERE category_id IN (
    SELECT id FROM categories WHERE kind = 'group'
);

-- Step 6: Update transactions to point to migrated category IDs if needed
-- This is a no-op if sub_categories.id was already the same as what's in transactions.category_id
-- But if transactions were using sub_categories.id directly, they should already work

-- Step 7: Optional - Drop the sub_categories table after migration
-- Uncomment the following line after verifying the migration worked:
-- DROP TABLE IF EXISTS sub_categories;

-- Step 8: Create index for performance
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_kind ON categories(kind);

