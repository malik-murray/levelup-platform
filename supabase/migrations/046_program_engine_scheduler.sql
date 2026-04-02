-- Migration: Program engine scheduler (strict weekdays + shift-forward)

CREATE TABLE IF NOT EXISTS fitness_active_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES fitness_workout_plans(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    progression_mode TEXT NOT NULL DEFAULT 'conservative' CHECK (progression_mode IN ('conservative', 'aggressive')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    training_weekdays INTEGER[] NOT NULL CHECK (
        array_length(training_weekdays, 1) >= 1
        AND training_weekdays <@ ARRAY[0,1,2,3,4,5,6]::INTEGER[]
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fitness_program_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    active_program_id UUID NOT NULL REFERENCES fitness_active_programs(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    day_index INTEGER NOT NULL CHECK (day_index >= 1 AND day_index <= 7),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'missed', 'completed')),
    session_id UUID NULL REFERENCES fitness_workout_sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(active_program_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_fitness_program_schedule_active_date
    ON fitness_program_schedule(active_program_id, scheduled_date);

ALTER TABLE fitness_active_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_program_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own active programs"
    ON fitness_active_programs FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own active programs"
    ON fitness_active_programs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own active programs"
    ON fitness_active_programs FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own active programs"
    ON fitness_active_programs FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own program schedule"
    ON fitness_program_schedule FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_active_programs ap
            WHERE ap.id = active_program_id
              AND ap.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert their own program schedule"
    ON fitness_program_schedule FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM fitness_active_programs ap
            WHERE ap.id = active_program_id
              AND ap.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update their own program schedule"
    ON fitness_program_schedule FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_active_programs ap
            WHERE ap.id = active_program_id
              AND ap.user_id = auth.uid()
        )
    );

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_fitness_active_programs_updated_at ON fitness_active_programs;
        CREATE TRIGGER update_fitness_active_programs_updated_at
            BEFORE UPDATE ON fitness_active_programs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
