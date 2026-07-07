-- Migration: Exercise category (strength/cardio/stretch) + reference rows for non-strength exercises

ALTER TABLE exercises
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'strength'
    CHECK (category IN ('strength', 'cardio', 'stretch'));

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);

COMMENT ON COLUMN exercises.category IS 'Broad exercise type: strength (resistance training), cardio, or stretch (mobility/yoga). Existing rows default to strength.';

-- Full-body muscle group for cardio/stretch exercises that don't target a single muscle group
INSERT INTO muscle_groups (name, slug, region)
VALUES
    ('Full Body', 'full-body', 'full')
ON CONFLICT (slug) DO NOTHING;

-- Equipment needed for the cardio/stretch seed exercises (037 already seeded bodyweight, dumbbell, etc.)
INSERT INTO equipment (name, slug)
VALUES
    ('Stationary Bike', 'stationary-bike'),
    ('Rowing Machine', 'rowing-machine'),
    ('Treadmill', 'treadmill'),
    ('Elliptical', 'elliptical'),
    ('Stair Climber', 'stair-climber'),
    ('Pool', 'pool'),
    ('Yoga Mat', 'yoga-mat')
ON CONFLICT (slug) DO NOTHING;
