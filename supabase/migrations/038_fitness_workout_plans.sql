-- Migration: Saved workout plans and plan items

-- =============================================================================
-- Table: fitness_workout_plans
-- =============================================================================

CREATE TABLE IF NOT EXISTS fitness_workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NULL,
    muscle_slugs TEXT[] NOT NULL DEFAULT '{}',
    difficulty TEXT NULL,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_plans_user_id
    ON fitness_workout_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_plans_is_template
    ON fitness_workout_plans(is_template);

-- updated_at trigger (uses existing update_updated_at_column() helper if present)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_fitness_workout_plans_updated_at ON fitness_workout_plans;
        CREATE TRIGGER update_fitness_workout_plans_updated_at
            BEFORE UPDATE ON fitness_workout_plans
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- =============================================================================
-- Table: fitness_workout_plan_items
-- =============================================================================

CREATE TABLE IF NOT EXISTS fitness_workout_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES fitness_workout_plans(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    exercise_slug TEXT NOT NULL,
    sets INTEGER NOT NULL,
    rep_range TEXT NOT NULL,
    rest_seconds INTEGER NOT NULL,
    note TEXT NULL,
    movement_pattern TEXT NULL,
    mechanic TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_fitness_workout_plan_items_position CHECK (position >= 0),
    CONSTRAINT chk_fitness_workout_plan_items_sets CHECK (sets > 0),
    CONSTRAINT chk_fitness_workout_plan_items_rest CHECK (rest_seconds >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fitness_workout_plan_items_plan_position
    ON fitness_workout_plan_items(plan_id, position);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_plan_items_plan_id
    ON fitness_workout_plan_items(plan_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE fitness_workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_workout_plan_items ENABLE ROW LEVEL SECURITY;

-- Plans:
-- 1) User-owned plans (user_id = auth.uid())
-- 2) Global templates: user_id IS NULL AND is_template = TRUE (readable by all authenticated users)

-- User-owned plans
CREATE POLICY "Users can view their own plans"
    ON fitness_workout_plans
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own plans"
    ON fitness_workout_plans
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own plans"
    ON fitness_workout_plans
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own plans"
    ON fitness_workout_plans
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Global template plans (read-only for all authenticated users)
CREATE POLICY "Users can view template plans"
    ON fitness_workout_plans
    FOR SELECT
    TO authenticated
    USING (user_id IS NULL AND is_template = TRUE);

-- Items:
-- Users can read/write items for plans they own.
-- Authenticated users can read items for global template plans.

CREATE POLICY "Users can view their own plan items"
    ON fitness_workout_plan_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_plans p
            WHERE p.id = plan_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own plan items"
    ON fitness_workout_plan_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM fitness_workout_plans p
            WHERE p.id = plan_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own plan items"
    ON fitness_workout_plan_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_plans p
            WHERE p.id = plan_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own plan items"
    ON fitness_workout_plan_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_plans p
            WHERE p.id = plan_id
              AND p.user_id = auth.uid()
        )
    );

-- Template items: readable for all authenticated users
CREATE POLICY "Users can view template plan items"
    ON fitness_workout_plan_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM fitness_workout_plans p
            WHERE p.id = plan_id
              AND p.user_id IS NULL
              AND p.is_template = TRUE
        )
    );

