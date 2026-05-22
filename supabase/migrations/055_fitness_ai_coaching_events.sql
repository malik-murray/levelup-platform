-- Migration: AI coaching event log and weekly recap cache

CREATE TABLE IF NOT EXISTS fitness_ai_coaching_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES fitness_workout_sessions(id) ON DELETE SET NULL,
    prompt_type TEXT NOT NULL,
    response_id TEXT,
    response_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_ai_coaching_events_user_created
    ON fitness_ai_coaching_events(user_id, created_at DESC);

ALTER TABLE fitness_ai_coaching_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own fitness ai coaching events" ON fitness_ai_coaching_events;
CREATE POLICY "Users can view their own fitness ai coaching events"
    ON fitness_ai_coaching_events FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own fitness ai coaching events" ON fitness_ai_coaching_events;
CREATE POLICY "Users can insert their own fitness ai coaching events"
    ON fitness_ai_coaching_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);
