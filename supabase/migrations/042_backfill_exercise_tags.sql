-- Migration: Backfill standardized tags for seeded exercise catalog
-- Purpose: make Phase 2 tag-based discovery useful out of the box.

WITH tag_map (slug, tags) AS (
    VALUES
        ('bench-press', ARRAY['strength', 'compound']::TEXT[]),
        ('incline-dumbbell-press', ARRAY['hypertrophy', 'compound']::TEXT[]),
        ('push-up', ARRAY['endurance', 'compound']::TEXT[]),
        ('cable-fly', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('incline-barbell-bench-press', ARRAY['strength', 'compound']::TEXT[]),

        ('lat-pulldown', ARRAY['hypertrophy', 'compound']::TEXT[]),
        ('pull-up', ARRAY['strength', 'compound']::TEXT[]),
        ('seated-cable-row', ARRAY['hypertrophy', 'compound']::TEXT[]),
        ('barbell-row', ARRAY['strength', 'compound']::TEXT[]),
        ('deadlift', ARRAY['strength', 'compound']::TEXT[]),
        ('face-pull', ARRAY['mobility', 'compound']::TEXT[]),

        ('overhead-press', ARRAY['strength', 'compound']::TEXT[]),
        ('lateral-raise', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('front-raise', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('reverse-fly', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('arnold-press', ARRAY['hypertrophy', 'compound']::TEXT[]),

        ('dumbbell-curl', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('hammer-curl', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('barbell-curl', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('cable-curl', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('preacher-curl', ARRAY['hypertrophy', 'isolation']::TEXT[]),

        ('tricep-pushdown', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('skull-crusher', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('overhead-tricep-extension', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('close-grip-bench-press', ARRAY['strength', 'compound']::TEXT[]),
        ('dips', ARRAY['strength', 'compound']::TEXT[]),

        ('plank', ARRAY['endurance', 'compound']::TEXT[]),
        ('hanging-knee-raise', ARRAY['endurance', 'compound']::TEXT[]),
        ('dead-bug', ARRAY['mobility', 'compound']::TEXT[]),
        ('cable-woodchop', ARRAY['mobility', 'compound']::TEXT[]),
        ('bicycle-crunch', ARRAY['endurance', 'compound']::TEXT[]),
        ('ab-wheel-rollout', ARRAY['strength', 'compound']::TEXT[]),

        ('back-squat', ARRAY['strength', 'compound']::TEXT[]),
        ('romanian-deadlift', ARRAY['strength', 'stretching', 'compound']::TEXT[]),
        ('walking-lunge', ARRAY['endurance', 'compound']::TEXT[]),
        ('hip-thrust', ARRAY['strength', 'compound']::TEXT[]),
        ('leg-press', ARRAY['hypertrophy', 'compound']::TEXT[]),
        ('leg-curl', ARRAY['hypertrophy', 'isolation']::TEXT[]),
        ('goblet-squat', ARRAY['hypertrophy', 'compound']::TEXT[]),
        ('bulgarian-split-squat', ARRAY['hypertrophy', 'compound']::TEXT[]),

        ('standing-calf-raise', ARRAY['hypertrophy', 'stretching', 'isolation']::TEXT[]),
        ('seated-calf-raise', ARRAY['hypertrophy', 'stretching', 'isolation']::TEXT[])
)
UPDATE exercises e
SET tags = tm.tags
FROM tag_map tm
WHERE e.slug = tm.slug;

