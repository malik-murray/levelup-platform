-- Migration: Add archive columns to habit_goals and habit_milestones
-- This allows users to archive completed goals and milestones

-- Add is_archived column to habit_goals
ALTER TABLE habit_goals
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add is_archived column to habit_milestones
ALTER TABLE habit_milestones
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add is_completed column to habit_milestones (for tracking individual milestone completion)
ALTER TABLE habit_milestones
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- Create index for faster queries on archived items
CREATE INDEX IF NOT EXISTS idx_habit_goals_is_archived ON habit_goals(is_archived);
CREATE INDEX IF NOT EXISTS idx_habit_milestones_is_archived ON habit_milestones(is_archived);
















