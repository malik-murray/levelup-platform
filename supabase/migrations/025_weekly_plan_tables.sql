-- Migration: Create weekly plan tables
-- This migration creates tables for weekly planning functionality

-- Table: habit_weekly_plans
-- Stores the weekly focus/intention and notes for each week
CREATE TABLE IF NOT EXISTS habit_weekly_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL, -- Sunday of the week
    focus_intention TEXT, -- Weekly intention/theme
    notes TEXT, -- Optional notes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start_date)
);

-- Table: habit_weekly_items
-- Stores the weekly goals/tasks
CREATE TABLE IF NOT EXISTS habit_weekly_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_plan_id UUID NOT NULL REFERENCES habit_weekly_plans(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    goal_id UUID REFERENCES habit_goals(id) ON DELETE SET NULL, -- Optional linked goal
    category TEXT CHECK (category IN ('work', 'family', 'health', 'finance', 'personal', 'business', 'education', 'relationships', 'other')),
    priority TEXT CHECK (priority IN ('low', 'med', 'high')) DEFAULT 'med',
    status TEXT CHECK (status IN ('not_started', 'in_progress', 'done')) DEFAULT 'not_started',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: habit_weekly_item_days
-- Junction table for assigning weekly items to specific days
CREATE TABLE IF NOT EXISTS habit_weekly_item_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    weekly_item_id UUID NOT NULL REFERENCES habit_weekly_items(id) ON DELETE CASCADE,
    date DATE NOT NULL, -- The specific day the item is assigned to
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(weekly_item_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_habit_weekly_plans_user_week ON habit_weekly_plans(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_items_plan_id ON habit_weekly_items(weekly_plan_id);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_items_user_id ON habit_weekly_items(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_item_days_item_id ON habit_weekly_item_days(weekly_item_id);
CREATE INDEX IF NOT EXISTS idx_habit_weekly_item_days_date ON habit_weekly_item_days(date);

