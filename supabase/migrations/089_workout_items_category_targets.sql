-- Migration: Category-aware targets on workout plan items and session items
-- Lets a plan/session item be strength (sets/rep_range/rest_seconds), cardio
-- (duration + optional cardio_type), or stretch (hold duration + rounds).

-- =============================================================================
-- fitness_workout_plan_items
-- =============================================================================

ALTER TABLE fitness_workout_plan_items
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'strength'
    CHECK (category IN ('strength', 'cardio', 'stretch'));

ALTER TABLE fitness_workout_plan_items ALTER COLUMN sets DROP NOT NULL;
ALTER TABLE fitness_workout_plan_items ALTER COLUMN rep_range DROP NOT NULL;
ALTER TABLE fitness_workout_plan_items ALTER COLUMN rest_seconds DROP NOT NULL;

ALTER TABLE fitness_workout_plan_items
    ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER NULL
        CHECK (target_duration_seconds IS NULL OR target_duration_seconds >= 0),
    ADD COLUMN IF NOT EXISTS target_rounds INTEGER NULL
        CHECK (target_rounds IS NULL OR target_rounds > 0),
    ADD COLUMN IF NOT EXISTS cardio_type TEXT NULL;

ALTER TABLE fitness_workout_plan_items
    DROP CONSTRAINT IF EXISTS chk_fitness_workout_plan_items_category_fields;

ALTER TABLE fitness_workout_plan_items
    ADD CONSTRAINT chk_fitness_workout_plan_items_category_fields CHECK (
        (category = 'strength' AND sets IS NOT NULL AND rep_range IS NOT NULL AND rest_seconds IS NOT NULL)
        OR (category IN ('cardio', 'stretch') AND target_duration_seconds IS NOT NULL)
    );

-- =============================================================================
-- fitness_workout_session_items
-- =============================================================================

ALTER TABLE fitness_workout_session_items
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'strength'
    CHECK (category IN ('strength', 'cardio', 'stretch'));

ALTER TABLE fitness_workout_session_items ALTER COLUMN target_sets DROP NOT NULL;
ALTER TABLE fitness_workout_session_items ALTER COLUMN target_rep_range DROP NOT NULL;
ALTER TABLE fitness_workout_session_items ALTER COLUMN target_rest_seconds DROP NOT NULL;

ALTER TABLE fitness_workout_session_items
    ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER NULL
        CHECK (target_duration_seconds IS NULL OR target_duration_seconds >= 0),
    ADD COLUMN IF NOT EXISTS target_rounds INTEGER NULL
        CHECK (target_rounds IS NULL OR target_rounds > 0),
    ADD COLUMN IF NOT EXISTS cardio_type TEXT NULL,
    ADD COLUMN IF NOT EXISTS actual_duration_seconds INTEGER NULL
        CHECK (actual_duration_seconds IS NULL OR actual_duration_seconds >= 0);

ALTER TABLE fitness_workout_session_items
    DROP CONSTRAINT IF EXISTS chk_fitness_workout_session_items_category_fields;

ALTER TABLE fitness_workout_session_items
    ADD CONSTRAINT chk_fitness_workout_session_items_category_fields CHECK (
        (category = 'strength' AND target_sets IS NOT NULL AND target_rep_range IS NOT NULL AND target_rest_seconds IS NOT NULL)
        OR (category IN ('cardio', 'stretch') AND target_duration_seconds IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_fitness_workout_plan_items_category ON fitness_workout_plan_items(category);
CREATE INDEX IF NOT EXISTS idx_fitness_workout_session_items_category ON fitness_workout_session_items(category);
