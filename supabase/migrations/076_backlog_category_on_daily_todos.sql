-- Link daily backlog todos to habit_backlog_categories groups

ALTER TABLE habit_daily_todos
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES habit_backlog_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_habit_daily_todos_category_id
    ON habit_daily_todos(user_id, category_id)
    WHERE is_done = false;

CREATE OR REPLACE FUNCTION sync_backlog_from_daily_todo()
RETURNS TRIGGER AS $$
DECLARE
    v_backlog_id UUID;
BEGIN
    IF NEW.backlog_task_id IS NULL THEN
        INSERT INTO habit_backlog_tasks (
            user_id,
            title,
            category_id,
            assigned_date,
            daily_item_type,
            completed_at,
            is_important,
            is_urgent
        ) VALUES (
            NEW.user_id,
            NEW.title,
            NEW.category_id,
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
            category_id = NEW.category_id,
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

DROP TRIGGER IF EXISTS trg_sync_backlog_from_daily_todo ON habit_daily_todos;
CREATE TRIGGER trg_sync_backlog_from_daily_todo
BEFORE INSERT OR UPDATE OF title, is_done, completed_at, date, backlog_task_id, is_important, is_urgent, category_id
ON habit_daily_todos
FOR EACH ROW
EXECUTE FUNCTION sync_backlog_from_daily_todo();
