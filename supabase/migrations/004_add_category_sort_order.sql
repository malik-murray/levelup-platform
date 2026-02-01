-- Migration: Add sort_order field to categories for custom ordering
-- This allows users to reorder categories and groups in their budget

-- Add sort_order column to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- Set initial sort_order based on existing order (name-based, which was the default)
-- Groups will have their own ordering, subcategories will be ordered within their groups
DO $$
DECLARE
    cat RECORD;
    group_order INTEGER := 0;
    category_order_map JSONB := '{}'::JSONB;
BEGIN
    -- First, set sort_order for groups
    FOR cat IN 
        SELECT id, name 
        FROM categories 
        WHERE kind = 'group' 
        ORDER BY name
    LOOP
        UPDATE categories 
        SET sort_order = group_order 
        WHERE id = cat.id;
        group_order := group_order + 1;
        
        -- Initialize order counter for this group's categories
        category_order_map := category_order_map || jsonb_build_object(cat.id::text, 0);
    END LOOP;
    
    -- Then, set sort_order for subcategories within each group
    FOR cat IN 
        SELECT id, name, parent_id 
        FROM categories 
        WHERE kind = 'category' AND parent_id IS NOT NULL
        ORDER BY parent_id, name
    LOOP
        DECLARE
            current_order INTEGER;
        BEGIN
            -- Get current order for this parent group
            current_order := COALESCE((category_order_map->>cat.parent_id::text)::INTEGER, 0);
            
            -- Update the category
            UPDATE categories 
            SET sort_order = current_order 
            WHERE id = cat.id;
            
            -- Increment order for this parent group
            category_order_map := category_order_map || jsonb_build_object(
                cat.parent_id::text, 
                current_order + 1
            );
        END;
    END LOOP;
END $$;

















