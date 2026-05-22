-- Migration: AI trainer personalization fields on fitness user profile

ALTER TABLE fitness_user_profiles
    ADD COLUMN IF NOT EXISTS coaching_tone TEXT DEFAULT 'encouraging';

ALTER TABLE fitness_user_profiles
    ADD COLUMN IF NOT EXISTS motivation_style TEXT DEFAULT 'short_cues';

ALTER TABLE fitness_user_profiles
    ADD COLUMN IF NOT EXISTS session_constraints JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE fitness_user_profiles
    ADD COLUMN IF NOT EXISTS injury_confidence_map JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE fitness_user_profiles
    DROP CONSTRAINT IF EXISTS chk_fitness_user_profiles_coaching_tone;

ALTER TABLE fitness_user_profiles
    ADD CONSTRAINT chk_fitness_user_profiles_coaching_tone
    CHECK (
        coaching_tone IN ('encouraging', 'tough_love', 'neutral')
    );

ALTER TABLE fitness_user_profiles
    DROP CONSTRAINT IF EXISTS chk_fitness_user_profiles_motivation_style;

ALTER TABLE fitness_user_profiles
    ADD CONSTRAINT chk_fitness_user_profiles_motivation_style
    CHECK (
        motivation_style IN ('short_cues', 'detailed_rationale')
    );
