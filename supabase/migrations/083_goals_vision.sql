-- Goals & Vision: vision statements, milestone due dates, backlog goal linking

ALTER TABLE habit_goals
ADD COLUMN IF NOT EXISTS vision_statement TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

ALTER TABLE habit_milestones
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE habit_backlog_tasks
ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES habit_goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_habit_backlog_tasks_goal_id ON habit_backlog_tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_goals_deadline ON habit_goals(deadline);
CREATE INDEX IF NOT EXISTS idx_habit_milestones_due_date ON habit_milestones(due_date);
