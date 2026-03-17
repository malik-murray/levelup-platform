-- Add optional time to daily todos (same pattern as weekly events: display as (8:00am) Title)
ALTER TABLE habit_daily_todos
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

CREATE INDEX IF NOT EXISTS idx_habit_daily_todos_start_time ON habit_daily_todos(start_time) WHERE start_time IS NOT NULL;
