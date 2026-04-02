-- Migration: Link sessions directly to program schedule rows

ALTER TABLE fitness_workout_sessions
    ADD COLUMN IF NOT EXISTS program_schedule_id UUID NULL REFERENCES fitness_program_schedule(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fitness_workout_sessions_program_schedule_id
    ON fitness_workout_sessions(program_schedule_id);
