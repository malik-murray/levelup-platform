-- Master backlog for habit planner tasks (priorities + todos)

CREATE TABLE IF NOT EXISTS habit_backlog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS habit_backlog_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category_id UUID REFERENCES habit_backlog_categories(id) ON DELETE SET NULL,
    priority_rank INTEGER NOT NULL DEFAULT 9999 CHECK (priority_rank > 0),
    assigned_date DATE NULL,
    daily_item_type TEXT NULL CHECK (daily_item_type IN ('priority', 'todo')),
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT backlog_assigned_type_consistency CHECK (
        (assigned_date IS NULL AND daily_item_type IS NULL)
        OR (assigned_date IS NOT NULL AND daily_item_type IS NOT NULL)
    )
);

ALTER TABLE habit_daily_priorities
ADD COLUMN IF NOT EXISTS backlog_task_id UUID REFERENCES habit_backlog_tasks(id) ON DELETE SET NULL;

ALTER TABLE habit_daily_todos
ADD COLUMN IF NOT EXISTS backlog_task_id UUID REFERENCES habit_backlog_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_habit_backlog_categories_user ON habit_backlog_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_backlog_tasks_user ON habit_backlog_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_backlog_tasks_open ON habit_backlog_tasks(user_id, completed_at, priority_rank);
CREATE INDEX IF NOT EXISTS idx_habit_backlog_tasks_assigned_date ON habit_backlog_tasks(user_id, assigned_date);
CREATE INDEX IF NOT EXISTS idx_habit_daily_priorities_backlog_task_id ON habit_daily_priorities(backlog_task_id);
CREATE INDEX IF NOT EXISTS idx_habit_daily_todos_backlog_task_id ON habit_daily_todos(backlog_task_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_habit_daily_priorities_backlog_per_day
    ON habit_daily_priorities(user_id, date, backlog_task_id)
    WHERE backlog_task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_habit_daily_todos_backlog_per_day
    ON habit_daily_todos(user_id, date, backlog_task_id)
    WHERE backlog_task_id IS NOT NULL;

ALTER TABLE habit_backlog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_backlog_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own backlog categories" ON habit_backlog_categories;
CREATE POLICY "Users can manage their own backlog categories"
    ON habit_backlog_categories FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own backlog tasks" ON habit_backlog_tasks;
CREATE POLICY "Users can manage their own backlog tasks"
    ON habit_backlog_tasks FOR ALL
    USING (auth.uid() = user_id);

INSERT INTO habit_backlog_categories (user_id, name)
SELECT u.id, c.name
FROM auth.users u
CROSS JOIN (
    VALUES ('Work'), ('Personal'), ('Financial'), ('Business'), ('Relationships')
) AS c(name)
ON CONFLICT (user_id, name) DO NOTHING;

CREATE OR REPLACE VIEW habit_backlog_tasks_effective AS
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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_backlog_from_daily_priority ON habit_daily_priorities;
CREATE TRIGGER trg_sync_backlog_from_daily_priority
BEFORE INSERT OR UPDATE OF text, completed, completed_at, date, backlog_task_id
ON habit_daily_priorities
FOR EACH ROW
EXECUTE FUNCTION sync_backlog_from_daily_priority();

DROP TRIGGER IF EXISTS trg_sync_backlog_from_daily_todo ON habit_daily_todos;
CREATE TRIGGER trg_sync_backlog_from_daily_todo
BEFORE INSERT OR UPDATE OF title, is_done, completed_at, date, backlog_task_id
ON habit_daily_todos
FOR EACH ROW
EXECUTE FUNCTION sync_backlog_from_daily_todo();