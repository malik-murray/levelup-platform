-- Lint 0011: immutable search_path on trigger functions (search-path injection hardening)

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_exercises_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_backlog_from_daily_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
            completed_at
        ) VALUES (
            NEW.user_id,
            NEW.text,
            GREATEST(COALESCE(NEW.sort_order, 999) + 1, 1),
            NEW.date,
            'priority',
            CASE WHEN NEW.completed THEN COALESCE(NEW.completed_at, NOW()) ELSE NULL END
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
            updated_at = NOW()
        WHERE id = NEW.backlog_task_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_backlog_from_daily_todo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_backlog_id UUID;
BEGIN
    IF NEW.backlog_task_id IS NULL THEN
        INSERT INTO habit_backlog_tasks (
            user_id,
            title,
            assigned_date,
            daily_item_type,
            completed_at
        ) VALUES (
            NEW.user_id,
            NEW.title,
            NEW.date,
            'todo',
            CASE WHEN NEW.is_done THEN COALESCE(NEW.completed_at, NOW()) ELSE NULL END
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
            updated_at = NOW()
        WHERE id = NEW.backlog_task_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;
