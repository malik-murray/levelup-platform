-- Plaid /transactions/sync cursor, pending transaction fields, spend notifications

-- plaid_items: per-item sync cursor and lightweight lock
ALTER TABLE public.plaid_items
    ADD COLUMN IF NOT EXISTS transactions_cursor TEXT,
    ADD COLUMN IF NOT EXISTS sync_in_progress_at TIMESTAMPTZ;

COMMENT ON COLUMN public.plaid_items.transactions_cursor IS
    'Plaid /transactions/sync cursor; null until first successful sync.';
COMMENT ON COLUMN public.plaid_items.sync_in_progress_at IS
    'Set while a sync job is running to reduce concurrent duplicate processing.';

-- transactions: Plaid pending/posted lifecycle + notifications
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS plaid_item_id UUID REFERENCES public.plaid_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS pending BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS pending_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS original_pending_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS transaction_datetime TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS iso_currency_code TEXT,
    ADD COLUMN IF NOT EXISTS payment_channel TEXT,
    ADD COLUMN IF NOT EXISTS plaid_category JSONB,
    ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS raw_plaid_transaction JSONB;

CREATE INDEX IF NOT EXISTS idx_transactions_pending_transaction_id
    ON public.transactions(pending_transaction_id)
    WHERE pending_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_account_date
    ON public.transactions(user_id, account_id, date);

CREATE INDEX IF NOT EXISTS idx_transactions_pending
    ON public.transactions(user_id, pending)
    WHERE pending = true AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_removed_at
    ON public.transactions(removed_at)
    WHERE removed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_plaid_item_id
    ON public.transactions(plaid_item_id);

-- Finance spend notification preferences (per user)
CREATE TABLE IF NOT EXISTS public.finance_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notify_spending_enabled BOOLEAN NOT NULL DEFAULT true,
    min_spending_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.finance_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own finance notification preferences"
    ON public.finance_notification_preferences
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Push device tokens (wire up mobile/web push providers)
CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'expo', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user_id
    ON public.user_push_subscriptions(user_id);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
    ON public.user_push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Idempotent notification audit log
CREATE TABLE IF NOT EXISTS public.notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    idempotency_key TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'push',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    payload JSONB,
    delivery_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'sent', 'skipped', 'failed')),
    delivery_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_user_id
    ON public.notification_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_transaction_id
    ON public.notification_events(transaction_id);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification events"
    ON public.notification_events
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notification events"
    ON public.notification_events
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notification events"
    ON public.notification_events
    FOR UPDATE
    USING (auth.uid() = user_id);
