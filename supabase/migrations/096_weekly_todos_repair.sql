-- Repair truncated migration 034 and support weekly to-do ↔ daily sync

CREATE TABLE IF NOT EXISTS habit_weekly_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_plan_id UUID REFERENCES habit_weekly_plans(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    sms_notify BOOLEAN DEFAULT false,
    todo_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE habit_weekly_events
    ADD COLUMN IF NOT EXISTS todo_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habit_weekly_events_todo_id_fkey'
    ) THEN
        ALTER TABLE habit_weekly_events
            ADD CONSTRAINT habit_weekly_events_todo_id_fkey
            FOREIGN KEY (todo_id) REFERENCES habit_daily_todos(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_habit_weekly_events_user_date
    ON habit_weekly_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_events_plan_id
    ON habit_weekly_events(weekly_plan_id);

ALTER TABLE habit_daily_todos
    ADD COLUMN IF NOT EXISTS weekly_event_id UUID,
    ADD COLUMN IF NOT EXISTS weekly_item_day_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habit_daily_todos_weekly_event_id_fkey'
    ) THEN
        ALTER TABLE habit_daily_todos
            ADD CONSTRAINT habit_daily_todos_weekly_event_id_fkey
            FOREIGN KEY (weekly_event_id) REFERENCES habit_weekly_events(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habit_daily_todos_weekly_item_day_id_fkey'
    ) THEN
        ALTER TABLE habit_daily_todos
            ADD CONSTRAINT habit_daily_todos_weekly_item_day_id_fkey
            FOREIGN KEY (weekly_item_day_id) REFERENCES habit_weekly_item_days(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE habit_weekly_items
    ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'todo';

UPDATE habit_weekly_items SET item_type = 'todo' WHERE item_type IS NULL;

ALTER TABLE habit_weekly_item_days
    ADD COLUMN IF NOT EXISTS todo_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habit_weekly_item_days_todo_id_fkey'
    ) THEN
        ALTER TABLE habit_weekly_item_days
            ADD CONSTRAINT habit_weekly_item_days_todo_id_fkey
            FOREIGN KEY (todo_id) REFERENCES habit_daily_todos(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE habit_weekly_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own weekly events" ON habit_weekly_events;
CREATE POLICY "Users can manage their own weekly events"
    ON habit_weekly_events FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
