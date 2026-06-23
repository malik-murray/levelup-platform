-- Unassigned backlog tasks should not appear on the daily dashboard until assigned to a day.

-- Remove daily todos that were auto-created for backlog items with no assigned date.
DELETE FROM habit_daily_todos t
USING habit_backlog_tasks bt
WHERE t.backlog_task_id = bt.id
  AND t.user_id = bt.user_id
  AND t.is_done = false
  AND bt.completed_at IS NULL
  AND bt.assigned_date IS NULL;

-- Clear stale assignment metadata on open backlog tasks that lost their daily row.
UPDATE habit_backlog_tasks
SET
    assigned_date = NULL,
    daily_item_type = NULL,
    updated_at = NOW()
WHERE completed_at IS NULL
  AND assigned_date IS NOT NULL
  AND daily_item_type = 'todo'
  AND NOT EXISTS (
      SELECT 1
      FROM habit_daily_todos t
      WHERE t.backlog_task_id = habit_backlog_tasks.id
        AND t.user_id = habit_backlog_tasks.user_id
        AND t.is_done = false
  );
