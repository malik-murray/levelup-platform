-- Default Eisenhower fields to false (not important, not urgent)

UPDATE habit_backlog_tasks
SET is_important = false
WHERE is_important IS NULL;

UPDATE habit_backlog_tasks
SET is_urgent = false
WHERE is_urgent IS NULL;

UPDATE habit_daily_priorities
SET is_important = false
WHERE is_important IS NULL;

UPDATE habit_daily_priorities
SET is_urgent = false
WHERE is_urgent IS NULL;

UPDATE habit_daily_todos
SET is_important = false
WHERE is_important IS NULL;

UPDATE habit_daily_todos
SET is_urgent = false
WHERE is_urgent IS NULL;

ALTER TABLE habit_backlog_tasks
ALTER COLUMN is_important SET DEFAULT false,
ALTER COLUMN is_urgent SET DEFAULT false;

ALTER TABLE habit_daily_priorities
ALTER COLUMN is_important SET DEFAULT false,
ALTER COLUMN is_urgent SET DEFAULT false;

ALTER TABLE habit_daily_todos
ALTER COLUMN is_important SET DEFAULT false,
ALTER COLUMN is_urgent SET DEFAULT false;
