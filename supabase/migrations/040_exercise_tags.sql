-- Migration: Add tags array to exercises for flexible metadata

ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN exercises.tags IS 'Free-form tags for filtering, e.g. movement style, context, or program labels.';

