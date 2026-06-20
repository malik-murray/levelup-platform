-- Repair open backlog tasks that lost their daily todo rows (e.g. duplicate cleanup).

-- Keep one open daily todo per backlog task; remove extras.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, backlog_task_id
            ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
    FROM habit_daily_todos
    WHERE is_done = false
      AND backlog_task_id IS NOT NULL
)
DELETE FROM habit_daily_todos
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Recreate missing open daily todos from the master backlog.
INSERT INTO habit_daily_todos (
    user_id,
    title,
    date,
    is_done,
    is_important,
    is_urgent,
    backlog_task_id,
    created_at
)
SELECT
    bt.user_id,
    bt.title,
    COALESCE(bt.assigned_date, CURRENT_DATE),
    false,
    COALESCE(bt.is_important, false),
    COALESCE(bt.is_urgent, false),
    bt.id,
    bt.created_at
FROM habit_backlog_tasks bt
WHERE bt.completed_at IS NULL
  AND (bt.daily_item_type IS NULL OR bt.daily_item_type = 'todo')
  AND NOT EXISTS (
      SELECT 1
      FROM habit_daily_todos t
      WHERE t.backlog_task_id = bt.id
        AND t.user_id = bt.user_id
        AND t.is_done = false
  );

-- Copy backlog task tags onto restored daily todos.
INSERT INTO habit_daily_todo_categories (user_id, todo_id, category_id)
SELECT t.user_id, t.id, btc.category_id
FROM habit_daily_todos t
JOIN habit_backlog_task_categories btc
    ON btc.backlog_task_id = t.backlog_task_id
   AND btc.user_id = t.user_id
WHERE t.is_done = false
  AND t.backlog_task_id IS NOT NULL
ON CONFLICT (todo_id, category_id) DO NOTHING;
