-- Many-to-many: habits ↔ goals and habits ↔ tracker categories

CREATE TABLE IF NOT EXISTS habit_template_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_template_id UUID NOT NULL REFERENCES habit_templates(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES habit_goals(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(habit_template_id, goal_id)
);

CREATE TABLE IF NOT EXISTS habit_template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_template_id UUID NOT NULL REFERENCES habit_templates(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('physical', 'mental', 'spiritual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(habit_template_id, category)
);

CREATE INDEX IF NOT EXISTS idx_habit_template_goals_user_habit
    ON habit_template_goals(user_id, habit_template_id);
CREATE INDEX IF NOT EXISTS idx_habit_template_goals_user_goal
    ON habit_template_goals(user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_template_categories_user_habit
    ON habit_template_categories(user_id, habit_template_id);

INSERT INTO habit_template_goals (user_id, habit_template_id, goal_id)
SELECT user_id, id, goal_id
FROM habit_templates
WHERE goal_id IS NOT NULL
ON CONFLICT (habit_template_id, goal_id) DO NOTHING;

INSERT INTO habit_template_categories (user_id, habit_template_id, category)
SELECT user_id, id, category
FROM habit_templates
WHERE category IS NOT NULL
ON CONFLICT (habit_template_id, category) DO NOTHING;

ALTER TABLE habit_template_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_template_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own habit template goals" ON habit_template_goals;
CREATE POLICY "Users can manage their own habit template goals"
    ON habit_template_goals FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own habit template categories" ON habit_template_categories;
CREATE POLICY "Users can manage their own habit template categories"
    ON habit_template_categories FOR ALL
    USING (auth.uid() = user_id);
