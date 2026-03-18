-- Migration: Saved exercises (favorites) for users

CREATE TABLE IF NOT EXISTS fitness_saved_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fitness_saved_exercises_user_exercise UNIQUE (user_id, exercise_id)
);

ALTER TABLE fitness_saved_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved exercises"
    ON fitness_saved_exercises
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their saved exercises"
    ON fitness_saved_exercises
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their saved exercises"
    ON fitness_saved_exercises
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

