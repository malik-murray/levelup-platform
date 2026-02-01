-- Fix habit tracker date offset issue
-- Dates were saved with UTC conversion causing a 1-day offset
-- This migration adds 1 day to all dates in habit tracker tables
-- Strategy: First move dates far out to avoid conflicts, then adjust back

-- Step 1: Move all dates far out (100 days) to avoid unique constraint conflicts
UPDATE habit_daily_entries
SET date = date + INTERVAL '100 days';

UPDATE habit_daily_priorities
SET date = date + INTERVAL '100 days';

UPDATE habit_daily_todos
SET date = date + INTERVAL '100 days';

UPDATE habit_daily_content
SET date = date + INTERVAL '100 days';

UPDATE habit_daily_scores
SET date = date + INTERVAL '100 days';

-- Step 2: Move dates back to correct position (subtract 99 days = net +1 day)
UPDATE habit_daily_entries
SET date = date - INTERVAL '99 days';

UPDATE habit_daily_priorities
SET date = date - INTERVAL '99 days';

UPDATE habit_daily_todos
SET date = date - INTERVAL '99 days';

UPDATE habit_daily_content
SET date = date - INTERVAL '99 days';

UPDATE habit_daily_scores
SET date = date - INTERVAL '99 days';

