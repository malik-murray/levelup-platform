-- Migration: Add day structure for workout plans

ALTER TABLE fitness_workout_plan_items
    ADD COLUMN IF NOT EXISTS day_index INTEGER NOT NULL DEFAULT 1;

ALTER TABLE fitness_workout_plan_items
    ADD CONSTRAINT chk_fitness_workout_plan_items_day_index
    CHECK (day_index >= 1 AND day_index <= 7);

CREATE INDEX IF NOT EXISTS idx_fitness_workout_plan_items_plan_day
    ON fitness_workout_plan_items(plan_id, day_index, position);
