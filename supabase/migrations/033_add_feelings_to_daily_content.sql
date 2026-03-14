-- Add feelings column to habit_daily_content
ALTER TABLE habit_daily_content
ADD COLUMN IF NOT EXISTS feelings TEXT;
