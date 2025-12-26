-- Migration: Life Tracker Upgrades
-- Adds goal linking, priority scores, deadlines, news updates, and user-editable scoring

-- Add priority_score and deadline to habit_goals
ALTER TABLE habit_goals
ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deadline DATE;

-- Add goal_id to habit_daily_priorities
ALTER TABLE habit_daily_priorities
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES habit_goals(id) ON DELETE SET NULL;

-- Add goal_id to habit_daily_todos
ALTER TABLE habit_daily_todos
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES habit_goals(id) ON DELETE SET NULL;

-- Add news_updates to habit_daily_content
ALTER TABLE habit_daily_content
ADD COLUMN IF NOT EXISTS news_updates TEXT;

-- Create index for goal_id on priorities and todos
CREATE INDEX IF NOT EXISTS idx_habit_daily_priorities_goal_id ON habit_daily_priorities(goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_daily_todos_goal_id ON habit_daily_todos(goal_id);

-- Create user scoring settings table
CREATE TABLE IF NOT EXISTS habit_scoring_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habits_weight DECIMAL(5, 2) NOT NULL DEFAULT 40.00 CHECK (habits_weight >= 0 AND habits_weight <= 100),
    priorities_weight DECIMAL(5, 2) NOT NULL DEFAULT 35.00 CHECK (priorities_weight >= 0 AND priorities_weight <= 100),
    todos_weight DECIMAL(5, 2) NOT NULL DEFAULT 25.00 CHECK (todos_weight >= 0 AND todos_weight <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id),
    CONSTRAINT weights_sum_to_100 CHECK (
        ABS(habits_weight + priorities_weight + todos_weight - 100.00) < 0.01
    )
);

CREATE INDEX IF NOT EXISTS idx_habit_scoring_settings_user_id ON habit_scoring_settings(user_id);

-- Enable RLS on scoring settings
ALTER TABLE habit_scoring_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own scoring settings" ON habit_scoring_settings;
CREATE POLICY "Users can manage their own scoring settings"
    ON habit_scoring_settings FOR ALL
    USING (auth.uid() = user_id);


