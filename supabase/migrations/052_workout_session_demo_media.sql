-- Optional URLs for AI-generated full-session workout demo videos (grid thumbnails / playback).

ALTER TABLE fitness_workout_sessions
    ADD COLUMN IF NOT EXISTS demo_video_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS demo_thumbnail_url TEXT NULL;

COMMENT ON COLUMN fitness_workout_sessions.demo_video_url IS 'URL to a full-session demo video (e.g. AI avatar + narration).';
COMMENT ON COLUMN fitness_workout_sessions.demo_thumbnail_url IS 'Poster image for the session card when demo_video_url is set.';
