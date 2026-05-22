-- Consolidate duplicate "Transportation" categories into one per user.
-- Moves all references to a single target category id.

DO $$
DECLARE
    u RECORD;
    target_id UUID;
BEGIN
    FOR u IN
        SELECT user_id
        FROM public.categories
        WHERE user_id IS NOT NULL
          AND kind = 'category'
          AND lower(name) = 'transportation'
        GROUP BY user_id
        HAVING COUNT(*) > 1
    LOOP
        -- Prefer active, then lowest sort_order, then deterministic id.
        SELECT c.id
        INTO target_id
        FROM public.categories c
        WHERE c.user_id = u.user_id
          AND c.kind = 'category'
          AND lower(c.name) = 'transportation'
        ORDER BY c.is_archived ASC, c.sort_order ASC NULLS LAST, c.id ASC
        LIMIT 1;

        -- Move transactions to the target transportation category.
        UPDATE public.transactions t
        SET category_id = target_id
        WHERE t.user_id = u.user_id
          AND t.category_id IN (
              SELECT c.id
              FROM public.categories c
              WHERE c.user_id = u.user_id
                AND c.kind = 'category'
                AND lower(c.name) = 'transportation'
                AND c.id <> target_id
          );

        -- Keep automation references aligned.
        UPDATE public.merchant_mappings mm
        SET category_id = target_id
        WHERE mm.user_id = u.user_id
          AND mm.category_id IN (
              SELECT c.id
              FROM public.categories c
              WHERE c.user_id = u.user_id
                AND c.kind = 'category'
                AND lower(c.name) = 'transportation'
                AND c.id <> target_id
          );

        UPDATE public.category_rules cr
        SET category_id = target_id
        WHERE cr.user_id = u.user_id
          AND cr.category_id IN (
              SELECT c.id
              FROM public.categories c
              WHERE c.user_id = u.user_id
                AND c.kind = 'category'
                AND lower(c.name) = 'transportation'
                AND c.id <> target_id
          );

        UPDATE public.recurring_items ri
        SET category_id = target_id
        WHERE ri.user_id = u.user_id
          AND ri.category_id IN (
              SELECT c.id
              FROM public.categories c
              WHERE c.user_id = u.user_id
                AND c.kind = 'category'
                AND lower(c.name) = 'transportation'
                AND c.id <> target_id
          );

        -- Archive duplicate transportation categories, keep only target active.
        UPDATE public.categories c
        SET is_archived = CASE WHEN c.id = target_id THEN false ELSE true END
        WHERE c.user_id = u.user_id
          AND c.kind = 'category'
          AND lower(c.name) = 'transportation';
    END LOOP;
END $$;
