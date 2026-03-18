-- Migration: Exercise database (MuscleWiki-style catalog foundation)
-- Global reference tables for muscle groups, equipment, and exercises.
-- No user_id; all users read the same catalog. Writes via service role / admin only.

-- =============================================================================
-- muscle_groups
-- =============================================================================
CREATE TABLE IF NOT EXISTS muscle_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    region TEXT NOT NULL CHECK (region IN ('upper', 'lower', 'core', 'full', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_muscle_groups_slug ON muscle_groups(slug);
CREATE INDEX IF NOT EXISTS idx_muscle_groups_region ON muscle_groups(region);

COMMENT ON TABLE muscle_groups IS 'Global reference: body regions/muscle groups for filtering and muscle map.';

-- =============================================================================
-- equipment
-- =============================================================================
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_slug ON equipment(slug);

COMMENT ON TABLE equipment IS 'Global reference: equipment required for exercises.';

-- =============================================================================
-- exercises
-- =============================================================================
-- Controlled vocabularies for CHECK constraints (scalable for filtering/search)
CREATE TABLE IF NOT EXISTS exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    primary_muscle_group_id UUID REFERENCES muscle_groups(id) ON DELETE SET NULL,
    secondary_muscle_group_ids UUID[] DEFAULT '{}',
    equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
    movement_pattern TEXT CHECK (movement_pattern IN (
        'push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'rotation', 'anti_rotation', 'other'
    )),
    force_type TEXT CHECK (force_type IN ('push', 'pull', 'static', 'other')),
    mechanic TEXT CHECK (mechanic IN ('compound', 'isolation', 'other')),
    short_description TEXT,
    instructions TEXT[] DEFAULT '{}',
    tips TEXT[] DEFAULT '{}',
    common_mistakes TEXT[] DEFAULT '{}',
    media_url TEXT,
    thumbnail_url TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for filtering, search, and future fitness_workouts linkage
CREATE INDEX IF NOT EXISTS idx_exercises_slug ON exercises(slug);
CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscle ON exercises(primary_muscle_group_id);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment_id);
CREATE INDEX IF NOT EXISTS idx_exercises_is_published ON exercises(is_published);
CREATE INDEX IF NOT EXISTS idx_exercises_difficulty ON exercises(difficulty);
CREATE INDEX IF NOT EXISTS idx_exercises_movement_pattern ON exercises(movement_pattern);
CREATE INDEX IF NOT EXISTS idx_exercises_force_type ON exercises(force_type);
CREATE INDEX IF NOT EXISTS idx_exercises_mechanic ON exercises(mechanic);
-- GIN index for array containment (e.g. filter by secondary muscle)
CREATE INDEX IF NOT EXISTS idx_exercises_secondary_muscles ON exercises USING GIN (secondary_muscle_group_ids);
-- Composite for common list view: published + muscle
CREATE INDEX IF NOT EXISTS idx_exercises_published_primary_muscle ON exercises(is_published, primary_muscle_group_id);

COMMENT ON TABLE exercises IS 'Global exercise catalog; link from fitness_workouts via exercise_id (future migration).';
COMMENT ON COLUMN exercises.secondary_muscle_group_ids IS 'UUIDs reference muscle_groups.id; integrity not enforced by FK (array).';

-- Optional: updated_at trigger (matches existing project style where used)
CREATE OR REPLACE FUNCTION set_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exercises_updated_at ON exercises;
CREATE TRIGGER exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW
    EXECUTE FUNCTION set_exercises_updated_at();

-- =============================================================================
-- RLS: read-only for authenticated users; no public write
-- =============================================================================
ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view muscle_groups"
    ON muscle_groups FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view equipment"
    ON equipment FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view exercises"
    ON exercises FOR SELECT
    TO authenticated
    USING (true);

-- No INSERT/UPDATE/DELETE policies for anon or authenticated; use service role for admin writes.
