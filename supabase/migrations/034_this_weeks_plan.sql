-- Migration: This Week's Plan feature
-- Adds habit_weekly_events, item_type to habit_weekly_items, habit_weekly_scores,
-- two-way linking (todo_id), and user preferences for SMS

-- 1. Add item_type to habit_weekly_items: 'goal' | 'todo'
ALTER TABLE habit_weekly_items
ADD COLUMN IF NOT EXISTS item_type TEXT CHECK (item_type IN ('goal', 'todo')) DEFAULT 'goal';

-- 2. Add todo_id to habit_weekly_item_days for two-way linking with habit_daily_todos
ALTER TABLE habit_weekly_item_days
ADD COLUMN IF NOT EXISTS todo_id UUID REFERENCES habit_daily_todos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_habit_weekly_item_days_todo_id ON habit_weekly_item_days(todo_id);

-- 3. habit_weekly_events table
CREATE TABLE IF NOT EXISTS habit_weekly_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_plan_id UUID NOT NULL REFERENCES habit_weekly_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    sms_notify BOOLEAN DEFAULT false,
    todo_id UUID REFERENCES habit_daily_todos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habit_weekly_events_user_id ON habit_weekly_events(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_events_weekly_plan_id ON habit_weekly_events(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_events_date ON habit_weekly_events(date);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_events_todo_id ON habit_weekly_events(todo_id);

ALTER TABLE habit_weekly_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own weekly events" ON habit_weekly_events;
CREATE POLICY "Users can manage their own weekly events"
    ON habit_weekly_events FOR ALL
    USING (auth.uid() = user_id);

-- 4. habit_weekly_scores - cache for weekly aggregates (computed from habit_daily_scores)
CREATE TABLE IF NOT EXISTS habit_weekly_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    avg_daily_score INTEGER DEFAULT 0,
    weekly_goals_score INTEGER DEFAULT 0,
    weekly_todos_score INTEGER DEFAULT 0,
    score_overall INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_weekly_scores_user_week ON habit_weekly_scores(user_id, week_start_date);

ALTER TABLE habit_weekly_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own weekly scores" ON habit_weekly_scores;
CREATE POLICY "Users can manage their own weekly scores"
    ON habit_weekly_scores FOR ALL
    USING (auth.uid() = user_id);

-- 5. habit_user_preferences - for SMS phone and future settings
-- SMS: sms_phone stores user phone for notifications.
-- TODO: Twilio integration - send SMS when sms_notify=true on events. See habit_weekly_events.sms_notify.
CREATE TABLE IF NOT EXISTS habit_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sms_phone TEXT,
    -- Future: calendar_sync_enabled, google_calendar_connected, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_habit_user_preferences_user_id ON habit_user_preferences(user_id);

ALTER TABLE habit_user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own habit preferences" ON habit_user_preferences;
CREATE POLICY "Users can manage their own habit preferences"
    ON habit_user_preferences FOR ALL
    USING (auth.uid() = user_id);

-- 6. Add reverse lookup columns to habit_daily_todos for sync
-- weekly_item_day_id: when this todo is synced from habit_weekly_item_days
-- weekly_event_id: when this todo is synced from habit_weekly_events
ALTER TABLE habit_daily_todos
ADD COLUMN IF NOT EXISTS weekly_item_day_id UUID REFERENCES habit_weekly_item_days(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS weekly_event_id UUID REFERENCES habit_weekly_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_habit_daily_todos_weekly_item_day_id ON habit_daily_todos(weekly_item_day_id);
CREATE INDEX IF NOT EXISTS idx_habit_daily_todos_weekly_event_id ON habit_daily_todos(weekly_event_id);
