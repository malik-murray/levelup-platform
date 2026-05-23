-- Store full Web Push subscription payload for web-push library delivery

ALTER TABLE public.user_push_subscriptions
    ADD COLUMN IF NOT EXISTS push_subscription JSONB;

COMMENT ON COLUMN public.user_push_subscriptions.push_subscription IS
    'Web Push PushSubscription JSON (endpoint + keys). Used when platform is web.';
