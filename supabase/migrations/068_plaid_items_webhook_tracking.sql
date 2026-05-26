-- Track when Plaid last called our webhook (debug + UI staleness)
ALTER TABLE public.plaid_items
    ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

COMMENT ON COLUMN public.plaid_items.last_webhook_at IS
    'Last time Plaid delivered a TRANSACTIONS webhook for this item';
