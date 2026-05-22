-- Merge "Travel" into "Transportation" (one category outcome).
-- For each user with both categories:
-- - Move references from Travel -> Transportation
-- - Archive Travel category
-- - Keep Transportation active

DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN
        SELECT
            t.user_id,
            t.id AS travel_id,
            tr.id AS transportation_id
        FROM public.categories t
        JOIN public.categories tr
          ON tr.user_id = t.user_id
        WHERE t.user_id IS NOT NULL
          AND t.kind = 'category'
          AND tr.kind = 'category'
          AND lower(t.name) = 'travel'
          AND lower(tr.name) = 'transportation'
    LOOP
        UPDATE public.transactions
        SET category_id = u.transportation_id
        WHERE user_id = u.user_id
          AND category_id = u.travel_id;

        UPDATE public.merchant_mappings
        SET category_id = u.transportation_id
        WHERE user_id = u.user_id
          AND category_id = u.travel_id;

        UPDATE public.category_rules
        SET category_id = u.transportation_id
        WHERE user_id = u.user_id
          AND category_id = u.travel_id;

        UPDATE public.recurring_items
        SET category_id = u.transportation_id
        WHERE user_id = u.user_id
          AND category_id = u.travel_id;

        UPDATE public.categories
        SET is_archived = true
        WHERE id = u.travel_id;

        UPDATE public.categories
        SET is_archived = false
        WHERE id = u.transportation_id;
    END LOOP;
END $$;
