-- Extend categorization_method to support recurring_items-based auto labels

DO $$
DECLARE
    cname text;
BEGIN
    SELECT con.conname INTO cname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.transactions'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%categorization_method%'
    LIMIT 1;

    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', cname);
    END IF;
END $$;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_categorization_method_check CHECK (
    categorization_method IS NULL
    OR categorization_method IN (
        'rule',
        'merchant_mapping',
        'ml_model',
        'user_override',
        'manual',
        'recurring_item'
    )
);
