-- Migration: Add completion timestamps to track when items are checked/completed
-- This migration adds checked_at/completed_at columns to track when habits, priorities, and todos are completed

-- Add checked_at column to habit_daily_entries (track when habit is checked)
ALTER TABLE habit_daily_entries
ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

-- Add completed_at column to habit_daily_priorities (track when priority is completed)
ALTER TABLE habit_daily_priorities
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add completed_at column to habit_daily_todos (track when todo is completed)
ALTER TABLE habit_daily_todos
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;






