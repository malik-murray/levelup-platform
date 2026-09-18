-- Optional: separate live institution balance from opening starting_balance.
-- App currently treats starting_balance as live for Plaid-linked rows (see accountBalances).
-- Run this when ready to split the two concepts cleanly.

ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS current_balance NUMERIC;

UPDATE public.accounts
SET current_balance = starting_balance
WHERE plaid_account_id IS NOT NULL
  AND current_balance IS NULL
  AND starting_balance IS NOT NULL;

COMMENT ON COLUMN public.accounts.current_balance IS
    'Latest institution-reported balance (e.g. from Plaid). Prefer this for display when set.';
