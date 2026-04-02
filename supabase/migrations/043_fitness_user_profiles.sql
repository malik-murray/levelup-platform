-- Migration: Fitness onboarding profile (single source of truth)

CREATE TABLE IF NOT EXISTS fitness_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    sex_identity TEXT NOT NULL CHECK (
        sex_identity IN (
            'male',
            'female',
            'non_binary',
            'trans_male',
            'trans_female',
            'genderqueer',
            'agender',
            'intersex',
            'prefer_not_to_say',
            'self_describe'
        )
    ),
    sex_identity_custom TEXT,
    age INTEGER NOT NULL CHECK (age >= 13 AND age <= 100),
    training_level TEXT NOT NULL CHECK (training_level IN ('beginner', 'intermediate', 'advanced')),
    goals TEXT[] NOT NULL CHECK (
        array_length(goals, 1) >= 1
        AND goals <@ ARRAY[
            'fat_loss',
            'muscle_gain',
            'strength',
            'general_fitness',
            'better_cardio',
            'muscle_endurance'
        ]::TEXT[]
    ),
    days_per_week INTEGER NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
    session_duration_minutes INTEGER NOT NULL CHECK (session_duration_minutes >= 15 AND session_duration_minutes <= 180),
    equipment_access TEXT[] NOT NULL CHECK (
        array_length(equipment_access, 1) >= 1
        AND equipment_access <@ ARRAY[
            'bodyweight',
            'dumbbells',
            'barbell',
            'machines',
            'resistance_bands',
            'kettlebells',
            'pull_up_bar',
            'cardio_machines',
            'full_gym',
            'other'
        ]::TEXT[]
    ),
    injuries_limitations TEXT,
    preferred_training_style TEXT CHECK (
        preferred_training_style IS NULL OR preferred_training_style IN (
            'balanced',
            'strength_focused',
            'hypertrophy_focused',
            'cardio_focused',
            'circuit',
            'minimalist'
        )
    ),
    is_onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (sex_identity = 'self_describe' AND sex_identity_custom IS NOT NULL AND length(trim(sex_identity_custom)) > 0)
        OR (sex_identity <> 'self_describe' AND (sex_identity_custom IS NULL OR length(trim(sex_identity_custom)) = 0))
    )
);

CREATE INDEX IF NOT EXISTS idx_fitness_user_profiles_user_id
    ON fitness_user_profiles(user_id);

ALTER TABLE fitness_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fitness profile"
    ON fitness_user_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fitness profile"
    ON fitness_user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fitness profile"
    ON fitness_user_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fitness profile"
    ON fitness_user_profiles FOR DELETE
    USING (auth.uid() = user_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_fitness_user_profiles_updated_at ON fitness_user_profiles;
        CREATE TRIGGER update_fitness_user_profiles_updated_at
            BEFORE UPDATE ON fitness_user_profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
