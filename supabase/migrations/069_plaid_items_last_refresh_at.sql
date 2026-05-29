ALTER TABLE public.plaid_items
    ADD COLUMN IF NOT EXISTS last_plaid_refresh_at TIMESTAMPTZ;

COMMENT ON COLUMN public.plaid_items.last_plaid_refresh_at IS
    'Last time we called Plaid /transactions/refresh for this item (rate-limited)';
