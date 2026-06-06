-- Custom habit reminder schedules: multiple times per category

ALTER TABLE public.habit_notification_preferences
    ADD COLUMN IF NOT EXISTS habit_reminder_times JSONB NOT NULL DEFAULT '["08:00","14:00","20:00"]'::jsonb,
    ADD COLUMN IF NOT EXISTS priorities_reminder_times JSONB NOT NULL DEFAULT '["07:30"]'::jsonb,
    ADD COLUMN IF NOT EXISTS todos_reminder_times JSONB NOT NULL DEFAULT '["09:00","18:00"]'::jsonb;

-- Migrate legacy single-time columns when present (from 071)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'habit_notification_preferences'
          AND column_name = 'morning_habit_time'
    ) THEN
        UPDATE public.habit_notification_preferences
        SET habit_reminder_times = (
            SELECT COALESCE(jsonb_agg(DISTINCT t ORDER BY t), '["08:00","14:00","20:00"]'::jsonb)
            FROM unnest(ARRAY[
                to_char(morning_habit_time, 'HH24:MI'),
                to_char(afternoon_habit_time, 'HH24:MI'),
                to_char(evening_habit_time, 'HH24:MI')
            ]::text[]) AS t
            WHERE t IS NOT NULL AND t <> ''
        );

        UPDATE public.habit_notification_preferences
        SET priorities_reminder_times = jsonb_build_array(
            to_char(priorities_reminder_time, 'HH24:MI')
        )
        WHERE priorities_reminder_time IS NOT NULL;

        UPDATE public.habit_notification_preferences
        SET todos_reminder_times = (
            SELECT COALESCE(jsonb_agg(DISTINCT t ORDER BY t), '["09:00","18:00"]'::jsonb)
            FROM unnest(ARRAY[
                to_char(todos_setup_reminder_time, 'HH24:MI'),
                to_char(todos_finish_reminder_time, 'HH24:MI')
            ]::text[]) AS t
            WHERE t IS NOT NULL AND t <> ''
        );

        ALTER TABLE public.habit_notification_preferences
            DROP COLUMN IF EXISTS morning_habit_time,
            DROP COLUMN IF EXISTS afternoon_habit_time,
            DROP COLUMN IF EXISTS evening_habit_time,
            DROP COLUMN IF EXISTS priorities_reminder_time,
            DROP COLUMN IF EXISTS todos_setup_reminder_time,
            DROP COLUMN IF EXISTS todos_finish_reminder_time;
    END IF;
END $$;

COMMENT ON COLUMN public.habit_notification_preferences.habit_reminder_times IS
    'JSON array of HH:MM times for incomplete-habit reminders (multiple per day allowed).';
COMMENT ON COLUMN public.habit_notification_preferences.priorities_reminder_times IS
    'JSON array of HH:MM times to nudge setting daily priorities.';
COMMENT ON COLUMN public.habit_notification_preferences.todos_reminder_times IS
    'JSON array of HH:MM times for to-do setup/finish reminders.';
