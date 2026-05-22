-- Move all transactions from "spending account" to "navy checking" per user.
-- Safe behavior:
-- - Only runs for users who have BOTH accounts.
-- - Matches names case-insensitively.

DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN
        SELECT
            source.user_id,
            source.id AS source_account_id,
            target.id AS target_account_id
        FROM public.accounts source
        JOIN public.accounts target
          ON target.user_id = source.user_id
        WHERE lower(source.name) = 'spending account'
          AND lower(target.name) = 'navy checking'
    LOOP
        UPDATE public.transactions t
        SET account_id = u.target_account_id
        WHERE t.user_id = u.user_id
          AND t.account_id = u.source_account_id;
    END LOOP;
END $$;
