-- Migration: Create habit tracker tables
-- This migration creates tables for goals, habits, daily entries, milestones, and scores

-- Table: habit_goals
CREATE TABLE IF NOT EXISTS habit_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    parent_goal_id UUID REFERENCES habit_goals(id) ON DELETE CASCADE, -- For sub-goals
    target_value NUMERIC,
    target_unit TEXT, -- e.g., 'lbs', 'views', 'days'
    current_value NUMERIC DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add category column if it doesn't exist (for existing tables)
ALTER TABLE habit_goals
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('financial', 'physical', 'spiritual', 'business', 'personal', 'mental', 'health', 'career', 'relationships', 'education', 'other'));

-- Table: habit_templates
CREATE TABLE IF NOT EXISTS habit_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT, -- emoji or icon identifier
    category TEXT NOT NULL CHECK (category IN ('physical', 'mental', 'spiritual')),
    time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening')),
    goal_id UUID REFERENCES habit_goals(id) ON DELETE SET NULL, -- Optional: habit tied to a goal
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_bad_habit column if it doesn't exist (for existing tables)
ALTER TABLE habit_templates
ADD COLUMN IF NOT EXISTS is_bad_habit BOOLEAN DEFAULT false;

-- Table: habit_daily_entries
CREATE TABLE IF NOT EXISTS habit_daily_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    habit_template_id UUID REFERENCES habit_templates(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('checked', 'half', 'missed')) DEFAULT 'missed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, habit_template_id)
);

-- Table: habit_daily_priorities
CREATE TABLE IF NOT EXISTS habit_daily_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    text TEXT NOT NULL,
    category TEXT CHECK (category IN ('physical', 'mental', 'spiritual')),
    time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening')),
    completed BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: habit_daily_todos
CREATE TABLE IF NOT EXISTS habit_daily_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title TEXT NOT NULL,
    category TEXT CHECK (category IN ('physical', 'mental', 'spiritual')),
    time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening')),
    is_done BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: habit_daily_content
CREATE TABLE IF NOT EXISTS habit_daily_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    lessons TEXT, -- Lessons of the Day
    ideas TEXT, -- Ideas
    notes TEXT, -- Notes
    distractions TEXT, -- Distractions/Bad Habits
    reflection TEXT, -- Reflection
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table: habit_milestones
CREATE TABLE IF NOT EXISTS habit_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES habit_goals(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Youtube views"
    values JSONB NOT NULL, -- Array of milestone values: [5, 10, 25, 100, 500, 1000]
    current_value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: habit_daily_scores
CREATE TABLE IF NOT EXISTS habit_daily_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Overall scores
    score_overall INTEGER NOT NULL DEFAULT 0, -- 0-100
    grade TEXT NOT NULL DEFAULT 'F', -- A, B, C, D, F
    -- Component scores (0-100)
    score_habits INTEGER NOT NULL DEFAULT 0, -- 40% weight
    score_priorities INTEGER NOT NULL DEFAULT 0, -- 35% weight
    score_todos INTEGER NOT NULL DEFAULT 0, -- 25% weight
    -- Category scores (0-100)
    score_physical INTEGER NOT NULL DEFAULT 0,
    score_mental INTEGER NOT NULL DEFAULT 0,
    score_spiritual INTEGER NOT NULL DEFAULT 0,
    -- Time of day scores (0-100)
    score_morning INTEGER NOT NULL DEFAULT 0,
    score_afternoon INTEGER NOT NULL DEFAULT 0,
    score_evening INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_habit_goals_user_id ON habit_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_goals_parent_id ON habit_goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_goals_category ON habit_goals(category);
CREATE INDEX IF NOT EXISTS idx_habit_templates_user_id ON habit_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_templates_goal_id ON habit_templates(goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_daily_entries_user_date ON habit_daily_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_daily_entries_habit_id ON habit_daily_entries(habit_template_id);
CREATE INDEX IF NOT EXISTS idx_habit_daily_priorities_user_date ON habit_daily_priorities(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_daily_todos_user_date ON habit_daily_todos(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_daily_content_user_date ON habit_daily_content(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_milestones_user_id ON habit_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_milestones_goal_id ON habit_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_daily_scores_user_date ON habit_daily_scores(user_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE habit_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_daily_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_daily_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_daily_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_daily_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
DROP POLICY IF EXISTS "Users can manage their own goals" ON habit_goals;
CREATE POLICY "Users can manage their own goals"
    ON habit_goals FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own habit templates" ON habit_templates;
CREATE POLICY "Users can manage their own habit templates"
    ON habit_templates FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own daily entries" ON habit_daily_entries;
CREATE POLICY "Users can manage their own daily entries"
    ON habit_daily_entries FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own daily priorities" ON habit_daily_priorities;
CREATE POLICY "Users can manage their own daily priorities"
    ON habit_daily_priorities FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own daily todos" ON habit_daily_todos;
CREATE POLICY "Users can manage their own daily todos"
    ON habit_daily_todos FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own daily content" ON habit_daily_content;
CREATE POLICY "Users can manage their own daily content"
    ON habit_daily_content FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own milestones" ON habit_milestones;
CREATE POLICY "Users can manage their own milestones"
    ON habit_milestones FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own daily scores" ON habit_daily_scores;
CREATE POLICY "Users can manage their own daily scores"
    ON habit_daily_scores FOR ALL
    USING (auth.uid() = user_id);

