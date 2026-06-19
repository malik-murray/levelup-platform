-- Eisenhower Matrix: important/urgent classification for tasks

ALTER TABLE habit_backlog_tasks
ADD COLUMN IF NOT EXISTS is_important BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS due_date DATE NULL;

ALTER TABLE habit_daily_priorities
ADD COLUMN IF NOT EXISTS is_important BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NULL;

ALTER TABLE habit_daily_todos
ADD COLUMN IF NOT EXISTS is_important BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NULL;

CREATE INDEX IF NOT EXISTS idx_habit_backlog_tasks_quadrant
    ON habit_backlog_tasks(user_id, completed_at, is_important, is_urgent)
    WHERE completed_at IS NULL;

-- Sync backlog from daily priority (include Eisenhower fields)
CREATE OR REPLACE FUNCTION sync_backlog_from_daily_priority()
RETURNS TRIGGER AS $$
DECLARE
    v_backlog_id UUID;
BEGIN
    IF NEW.backlog_task_id IS NULL THEN
        INSERT INTO habit_backlog_tasks (
            user_id,
            title,
            priority_rank,
            assigned_date,
            daily_item_type,
            completed_at,
            is_important,
            is_urgent
        ) VALUES (
            NEW.user_id,
            NEW.text,
            GREATEST(COALESCE(NEW.sort_order, 999) + 1, 1),
            NEW.date,
            'priority',
            CASE WHEN NEW.completed THEN COALESCE(NEW.completed_at, NOW()) ELSE NULL END,
            NEW.is_important,
            NEW.is_urgent
        )
        RETURNING id INTO v_backlog_id;
        NEW.backlog_task_id := v_backlog_id;
    ELSE
        UPDATE habit_backlog_tasks
        SET
            title = NEW.text,
            assigned_date = NEW.date,
            daily_item_type = 'priority',
            completed_at = CASE WHEN NEW.completed THEN COALESCE(NEW.completed_at, NOW()) ELSE NULL END,
            is_important = NEW.is_important,
            is_urgent = NEW.is_urgent,
            updated_at = NOW()
        WHERE id = NEW.backlog_task_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync backlog from daily todo (include Eisenhower fields)
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

DROP TRIGGER IF EXISTS trg_sync_backlog_from_daily_priority ON habit_daily_priorities;
CREATE TRIGGER trg_sync_backlog_from_daily_priority
BEFORE INSERT OR UPDATE OF text, completed, completed_at, date, backlog_task_id, is_important, is_urgent
ON habit_daily_priorities
FOR EACH ROW
EXECUTE FUNCTION sync_backlog_from_daily_priority();

DROP TRIGGER IF EXISTS trg_sync_backlog_from_daily_todo ON habit_daily_todos;
CREATE TRIGGER trg_sync_backlog_from_daily_todo
BEFORE INSERT OR UPDATE OF title, is_done, completed_at, date, backlog_task_id, is_important, is_urgent
ON habit_daily_todos
FOR EACH ROW
EXECUTE FUNCTION sync_backlog_from_daily_todo();
