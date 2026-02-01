-- Migration: Create table for Do Next custom order
-- This table stores the user-defined order of items in the "Do Next" section
-- allowing cross-device synchronization

CREATE TABLE IF NOT EXISTS habit_do_next_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('habit', 'priority', 'todo')),
    item_id UUID NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_habit_do_next_order_user_date ON habit_do_next_order(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_do_next_order_sort_order ON habit_do_next_order(user_id, date, sort_order);

-- Enable RLS
ALTER TABLE habit_do_next_order ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage their own do next order" ON habit_do_next_order;

-- Create policy for users to manage their own do next order
CREATE POLICY "Users can manage their own do next order"
    ON habit_do_next_order FOR ALL
    USING (auth.uid() = user_id);






