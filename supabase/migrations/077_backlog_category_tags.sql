-- Multiple category tags per backlog item (many-to-many)

CREATE TABLE IF NOT EXISTS habit_daily_todo_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    todo_id UUID NOT NULL REFERENCES habit_daily_todos(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES habit_backlog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(todo_id, category_id)
);

CREATE TABLE IF NOT EXISTS habit_backlog_task_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    backlog_task_id UUID NOT NULL REFERENCES habit_backlog_tasks(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES habit_backlog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(backlog_task_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_habit_daily_todo_categories_user_todo
    ON habit_daily_todo_categories(user_id, todo_id);
CREATE INDEX IF NOT EXISTS idx_habit_daily_todo_categories_user_category
    ON habit_daily_todo_categories(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_habit_backlog_task_categories_user_task
    ON habit_backlog_task_categories(user_id, backlog_task_id);

INSERT INTO habit_daily_todo_categories (user_id, todo_id, category_id)
SELECT user_id, id, category_id
FROM habit_daily_todos
WHERE category_id IS NOT NULL
ON CONFLICT (todo_id, category_id) DO NOTHING;

INSERT INTO habit_backlog_task_categories (user_id, backlog_task_id, category_id)
SELECT user_id, id, category_id
FROM habit_backlog_tasks
WHERE category_id IS NOT NULL
ON CONFLICT (backlog_task_id, category_id) DO NOTHING;

-- Drop trigger before removing category_id (076 trigger lists that column in UPDATE OF)
DROP TRIGGER IF EXISTS trg_sync_backlog_from_daily_todo ON habit_daily_todos;

CREATE OR REPLACE FUNCTION sync_backlog_from_daily_todo()
RETURNS TRIGGER AS $$
DECLARE
    v_backlog_id UUID;
BEGIN
    IF NEW.backlog_task_id IS NULL THEN
        INSERT INTO habit_backlog_tasks (
            user_id,
            title,
            assigned_date,
            daily_item_type,
            completed_at,
            is_important,
            is_urgent
        ) VALUES (
            NEW.user_id,
            NEW.title,
            NEW.date,
            'todo',
            CASE WHEN NEW.is_done THEN COALESCE(NEW.completed_at, NOW()) ELSE NULL END,
            NEW.is_important,
            NEW.is_urgent
        )
        RETURNING id INTO v_backlog_id;
        NEW.backlog_task_id := v_backlog_id;
    ELSE
        UPDATE habit_backlog_tasks
        SET
            title = NEW.title,
            assigned_date = NEW.date,
            daily_item_type = 'todo',
            completed_at = CASE WHEN NEW.is_done THEN COALESCE(NEW.completed_at, NOW()) ELSE NULL END,
            is_important = NEW.is_important,
            is_urgent = NEW.is_urgent,
            updated_at = NOW()
        WHERE id = NEW.backlog_task_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP VIEW IF EXISTS habit_backlog_tasks_effective;

ALTER TABLE habit_daily_todos DROP COLUMN IF EXISTS category_id;

ALTER TABLE habit_backlog_tasks DROP COLUMN IF EXISTS category_id;

DROP INDEX IF EXISTS idx_habit_daily_todos_category_id;

CREATE VIEW habit_backlog_tasks_effective
WITH (security_invoker = true) AS
SELECT
    t.*,
    CASE
        WHEN t.completed_at IS NULL AND t.assigned_date IS NOT NULL AND t.assigned_date < CURRENT_DATE THEN NULL
        ELSE t.assigned_date
    END AS effective_assigned_date,
    CASE
        WHEN t.completed_at IS NULL AND t.assigned_date IS NOT NULL AND t.assigned_date < CURRENT_DATE THEN NULL
        ELSE t.daily_item_type
    END AS effective_daily_item_type
FROM habit_backlog_tasks t;

ALTER TABLE habit_daily_todo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_backlog_task_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own todo category tags" ON habit_daily_todo_categories;
CREATE POLICY "Users can manage their own todo category tags"
    ON habit_daily_todo_categories FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own backlog task category tags" ON habit_backlog_task_categories;
CREATE POLICY "Users can manage their own backlog task category tags"
    ON habit_backlog_task_categories FOR ALL
    USING (auth.uid() = user_id);

CREATE TRIGGER trg_sync_backlog_from_daily_todo
BEFORE INSERT OR UPDATE OF title, is_done, completed_at, date, backlog_task_id, is_important, is_urgent
ON habit_daily_todos
FOR EACH ROW
EXECUTE FUNCTION sync_backlog_from_daily_todo();
