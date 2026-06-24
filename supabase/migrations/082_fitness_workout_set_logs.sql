-- Migration: Per-set workout logging (reps, weight, RPE, notes)

CREATE TABLE IF NOT EXISTS fitness_workout_set_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_item_id UUID NOT NULL REFERENCES fitness_workout_session_items(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL CHECK (set_number > 0),
    reps INTEGER NULL CHECK (reps IS NULL OR reps >= 0),
    weight_kg NUMERIC(7, 2) NULL CHECK (weight_kg IS NULL OR weight_kg >= 0),
    rpe NUMERIC(3, 1) NULL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
    duration_seconds INTEGER NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    is_warmup BOOLEAN NOT NULL DEFAULT false,
    notes TEXT NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fitness_workout_set_logs_item_set UNIQUE (session_item_id, set_number)
);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_set_logs_session_item_id
    ON fitness_workout_set_logs(session_item_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_fitness_workout_set_logs_updated_at ON fitness_workout_set_logs;
        CREATE TRIGGER update_fitness_workout_set_logs_updated_at
            BEFORE UPDATE ON fitness_workout_set_logs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

ALTER TABLE fitness_workout_set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own set logs"
    ON fitness_workout_set_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_session_items i
            JOIN fitness_workout_sessions s ON s.id = i.session_id
            WHERE i.id = session_item_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own set logs"
    ON fitness_workout_set_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM fitness_workout_session_items i
            JOIN fitness_workout_sessions s ON s.id = i.session_id
            WHERE i.id = session_item_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own set logs"
    ON fitness_workout_set_logs
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_session_items i
            JOIN fitness_workout_sessions s ON s.id = i.session_id
            WHERE i.id = session_item_id
              AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own set logs"
    ON fitness_workout_set_logs
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_session_items i
            JOIN fitness_workout_sessions s ON s.id = i.session_id
            WHERE i.id = session_item_id
              AND s.user_id = auth.uid()
        )
    );
