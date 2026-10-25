-- Optional first-class credit_limit column on accounts.
-- The Accounts UI currently stores limits in user_profile.preferences.accountCreditLimits
-- so editing works without this migration. Apply later to denormalize onto accounts.

ALTER TABLE public.accounts
    ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2);

COMMENT ON COLUMN public.accounts.credit_limit IS
    'Credit card / line of credit limit. Available credit = limit − amount owed.';
