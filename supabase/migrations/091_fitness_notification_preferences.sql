-- Fitness workout reminder push preferences (opt-in accountability nudge)

CREATE TABLE IF NOT EXISTS public.fitness_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notify_workout_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    workout_reminder_time TIME NOT NULL DEFAULT '18:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fitness_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fitness notification preferences"
    ON public.fitness_notification_preferences
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN public.fitness_notification_preferences.workout_reminder_time IS
    'Local HH:MM time to nudge the user if a scheduled workout is still incomplete today.';

COMMENT ON COLUMN public.notification_events.event_type IS
    'finance_spend | habit_reminder | priorities_reminder | todos_reminder | fitness_workout_reminder';
