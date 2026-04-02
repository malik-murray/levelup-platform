-- Supabase linter: security_invoker view (lint 0010) + RLS on public tables (lint 0013)

-- View must run with querying user's privileges so habit_backlog_tasks RLS applies.
DROP VIEW IF EXISTS habit_backlog_tasks_effective;
CREATE VIEW habit_backlog_tasks_effective
WITH (security_invoker = true) AS
SELECT
    t.*,
    CASE
        WHEN t.completed_at IS NULL AND t.assigned_date IS NOT NULL AND t.assigned_date < CURRENT_DATE THEN NULL
        ELSE t.assigned_date
    END AS effective_assigned_date,
    CASE
        WHEN t.completed_at IS NULL AND t.assigned_date IS NOT NULL AND t.assigned_date < CURRENT_DATE THEN NULL
        ELSE t.daily_item_type
    END AS effective_daily_item_type
FROM habit_backlog_tasks t;

-- Resume generator (user-owned)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own resume user settings" ON user_settings;
CREATE POLICY "Users can manage their own resume user settings"
    ON user_settings FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own credits" ON credits;
CREATE POLICY "Users can manage their own credits"
    ON credits FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own generations" ON generations;
CREATE POLICY "Users can manage their own generations"
    ON generations FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Shared template catalog (read via API; writes via migrations/service role)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read templates" ON templates;
CREATE POLICY "Anyone can read templates"
    ON templates FOR SELECT
    USING (true);

-- Weekly habit planner
ALTER TABLE habit_weekly_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own weekly plans" ON habit_weekly_plans;
CREATE POLICY "Users can manage their own weekly plans"
    ON habit_weekly_plans FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

ALTER TABLE habit_weekly_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own weekly items" ON habit_weekly_items;
CREATE POLICY "Users can manage their own weekly items"
    ON habit_weekly_items FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

ALTER TABLE habit_weekly_item_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own weekly item days" ON habit_weekly_item_days;
CREATE POLICY "Users can manage their own weekly item days"
    ON habit_weekly_item_days FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM habit_weekly_items wi
            WHERE wi.id = habit_weekly_item_days.weekly_item_id
              AND wi.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM habit_weekly_items wi
            WHERE wi.id = weekly_item_id
              AND wi.user_id = auth.uid()
        )
    );

-- Newsfeed: master lists (read-only for clients; ingestion uses service role)
ALTER TABLE newsfeed_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read newsfeed sources" ON newsfeed_sources;
CREATE POLICY "Anyone can read newsfeed sources"
    ON newsfeed_sources FOR SELECT
    USING (true);

ALTER TABLE newsfeed_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read newsfeed topics" ON newsfeed_topics;
CREATE POLICY "Anyone can read newsfeed topics"
    ON newsfeed_topics FOR SELECT
    USING (true);

-- Newsfeed: user-owned rows
ALTER TABLE newsfeed_user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own newsfeed preferences" ON newsfeed_user_preferences;
CREATE POLICY "Users can manage their own newsfeed preferences"
    ON newsfeed_user_preferences FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

ALTER TABLE newsfeed_user_context ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own newsfeed context" ON newsfeed_user_context;
CREATE POLICY "Users can manage their own newsfeed context"
    ON newsfeed_user_context FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Summaries are global content keyed to articles (same exposure model as newsfeed_articles)
ALTER TABLE newsfeed_article_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read article summaries" ON newsfeed_article_summaries;
CREATE POLICY "Anyone can read article summaries"
    ON newsfeed_article_summaries FOR SELECT
    USING (true);
