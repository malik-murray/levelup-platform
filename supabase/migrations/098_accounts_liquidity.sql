-- Optional first-class liquidity column on accounts.
-- The Accounts UI currently stores liquidity in user_profile.preferences.accountLiquidity
-- so tagging works without this migration. Apply later to denormalize onto accounts.

ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS liquidity TEXT;

ALTER TABLE public.accounts
    DROP CONSTRAINT IF EXISTS accounts_liquidity_check;

ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_liquidity_check
    CHECK (
        liquidity IS NULL
        OR liquidity IN ('liquid', 'reserved', 'locked')
    );

COMMENT ON COLUMN public.accounts.liquidity IS
    'How accessible funds are: liquid | reserved | locked (retirement/long-term).';
