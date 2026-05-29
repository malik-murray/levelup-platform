ALTER TABLE public.plaid_items
    ADD COLUMN IF NOT EXISTS last_cron_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN public.plaid_items.last_cron_sync_at IS
    'Last time a server cron job synced this item (app closed)';
