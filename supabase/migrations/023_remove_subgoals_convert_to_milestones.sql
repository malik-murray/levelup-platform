-- Migration: Remove sub-goals and convert them to milestones
-- This migration converts all existing sub-goals (goals with parent_goal_id) into milestones

-- Convert all sub-goals to milestones
INSERT INTO habit_milestones (user_id, goal_id, name, values, current_value, is_completed, is_archived, created_at, updated_at)
SELECT 
    user_id,
    parent_goal_id as goal_id,
    name,
    CASE 
        WHEN target_value IS NOT NULL THEN to_jsonb(ARRAY[target_value]::numeric[])
        ELSE '[]'::jsonb
    END as values,
    COALESCE(current_value, 0) as current_value,
    is_completed,
    is_archived,
    created_at,
    updated_at
FROM habit_goals
WHERE parent_goal_id IS NOT NULL;

-- Delete all sub-goals (goals with parent_goal_id)
DELETE FROM habit_goals
WHERE parent_goal_id IS NOT NULL;

-- Note: We're keeping the parent_goal_id column in the table for now to avoid breaking existing code
-- It will be removed in a future migration after code cleanup

