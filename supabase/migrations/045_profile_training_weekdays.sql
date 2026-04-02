-- Migration: Let users choose exact training weekdays in onboarding profile

ALTER TABLE fitness_user_profiles
    ADD COLUMN IF NOT EXISTS training_weekdays INTEGER[] NOT NULL DEFAULT ARRAY[1,3,5];

ALTER TABLE fitness_user_profiles
    DROP CONSTRAINT IF EXISTS chk_fitness_user_profiles_training_weekdays;

ALTER TABLE fitness_user_profiles
    ADD CONSTRAINT chk_fitness_user_profiles_training_weekdays
    CHECK (
        array_length(training_weekdays, 1) >= 1
        AND array_length(training_weekdays, 1) <= 7
        AND training_weekdays <@ ARRAY[0,1,2,3,4,5,6]::INTEGER[]
    );

UPDATE fitness_user_profiles
SET days_per_week = COALESCE(array_length(training_weekdays, 1), days_per_week)
WHERE training_weekdays IS NOT NULL;
