-- Score recap and plan-tomorrow push notification preferences

ALTER TABLE public.habit_notification_preferences
    ADD COLUMN IF NOT EXISTS notify_morning_score_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_afternoon_score_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_evening_score_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notify_plan_tomorrow_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS morning_score_time TIME NOT NULL DEFAULT '12:00',
    ADD COLUMN IF NOT EXISTS afternoon_score_time TIME NOT NULL DEFAULT '17:00',
    ADD COLUMN IF NOT EXISTS evening_score_time TIME NOT NULL DEFAULT '21:00',
    ADD COLUMN IF NOT EXISTS plan_tomorrow_time TIME NOT NULL DEFAULT '20:30';

COMMENT ON COLUMN public.habit_notification_preferences.morning_score_time IS
    'When to send the morning habit score recap (default noon).';
COMMENT ON COLUMN public.habit_notification_preferences.plan_tomorrow_time IS
    'End-of-day nudge to plan the next day (default 8:30pm).';
