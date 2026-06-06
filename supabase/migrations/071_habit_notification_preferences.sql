-- Habit tracker push reminder preferences

CREATE TABLE IF NOT EXISTS public.habit_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notify_habits_enabled BOOLEAN NOT NULL DEFAULT true,
    notify_priorities_enabled BOOLEAN NOT NULL DEFAULT true,
    notify_todos_enabled BOOLEAN NOT NULL DEFAULT true,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    morning_habit_time TIME NOT NULL DEFAULT '08:00',
    afternoon_habit_time TIME NOT NULL DEFAULT '14:00',
    evening_habit_time TIME NOT NULL DEFAULT '20:00',
    priorities_reminder_time TIME NOT NULL DEFAULT '07:30',
    todos_setup_reminder_time TIME NOT NULL DEFAULT '09:00',
    todos_finish_reminder_time TIME NOT NULL DEFAULT '18:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.habit_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own habit notification preferences"
    ON public.habit_notification_preferences
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Extend notification audit log for non-finance events
ALTER TABLE public.notification_events
    ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'finance_spend';

COMMENT ON COLUMN public.notification_events.event_type IS
    'finance_spend | habit_reminder | priorities_reminder | todos_reminder';
