-- Migration: Workout sessions and session items

-- =============================================================================
-- Table: fitness_workout_sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS fitness_workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NULL REFERENCES fitness_workout_plans(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    name TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_sessions_user_id
    ON fitness_workout_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_sessions_plan_id
    ON fitness_workout_sessions(plan_id);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_sessions_status
    ON fitness_workout_sessions(status);

-- updated_at trigger (reuse update_updated_at_column() if present)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_fitness_workout_sessions_updated_at ON fitness_workout_sessions;
        CREATE TRIGGER update_fitness_workout_sessions_updated_at
            BEFORE UPDATE ON fitness_workout_sessions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- =============================================================================
-- Table: fitness_workout_session_items
-- =============================================================================

CREATE TABLE IF NOT EXISTS fitness_workout_session_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES fitness_workout_sessions(id) ON DELETE CASCADE,
    plan_item_id UUID NULL REFERENCES fitness_workout_plan_items(id) ON DELETE SET NULL,
    position INTEGER NOT NULL,
    exercise_slug TEXT NOT NULL,
    -- Snapshot targets at session start
    target_sets INTEGER NOT NULL,
    target_rep_range TEXT NOT NULL,
    target_rest_seconds INTEGER NOT NULL,
    target_note TEXT NULL,
    target_movement_pattern TEXT NULL,
    target_mechanic TEXT NULL,
    -- Optional actual performance fields (future use)
    actual_sets_completed INTEGER NULL,
    actual_avg_reps_per_set NUMERIC NULL,
    actual_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fitness_workout_session_items_position CHECK (position >= 0),
    CONSTRAINT chk_fitness_workout_session_items_target_sets CHECK (target_sets > 0),
    CONSTRAINT chk_fitness_workout_session_items_target_rest CHECK (target_rest_seconds >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fitness_workout_session_items_session_position
    ON fitness_workout_session_items(session_id, position);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_session_items_session_id
    ON fitness_workout_session_items(session_id);

-- updated_at trigger
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_fitness_workout_session_items_updated_at ON fitness_workout_session_items;
        CREATE TRIGGER update_fitness_workout_session_items_updated_at
            BEFORE UPDATE ON fitness_workout_session_items
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE fitness_workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_workout_session_items ENABLE ROW LEVEL SECURITY;

-- Sessions: users can only manage their own sessions

CREATE POLICY "Users can view their own sessions"
    ON fitness_workout_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sessions"
    ON fitness_workout_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
    ON fitness_workout_sessions
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
    ON fitness_workout_sessions
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Session items: restricted via parent session's user_id

CREATE POLICY "Users can view their own session items"
    ON fitness_workout_session_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_sessions s
            WHERE s.id = session_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own session items"
    ON fitness_workout_session_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM fitness_workout_sessions s
            WHERE s.id = session_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own session items"
    ON fitness_workout_session_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_sessions s
            WHERE s.id = session_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own session items"
    ON fitness_workout_session_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_sessions s
            WHERE s.id = session_id
              AND s.user_id = auth.uid()
        )
    );

