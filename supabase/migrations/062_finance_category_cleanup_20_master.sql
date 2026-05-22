-- Consolidate finance categories to a 20-category master taxonomy.
-- Strategy:
-- 1) Ensure categories support soft archive via is_archived.
-- 2) Create/ensure 20 canonical category rows per user.
-- 3) Remap transactions + automation tables to canonical categories.
-- 4) Send unmatched legacy categories to "Needs Review".
-- 5) Archive non-canonical user categories.

ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_categories_user_archived
    ON public.categories(user_id, is_archived);

DO $$
DECLARE
    u RECORD;
    needs_review_id UUID;
BEGIN
    CREATE TEMP TABLE canonical_categories (
        name TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        sort_order INTEGER NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO canonical_categories (name, type, sort_order) VALUES
        ('Income', 'income', 1),
        ('Transfer', 'expense', 2),
        ('Housing', 'expense', 3),
        ('Utilities', 'expense', 4),
        ('Groceries', 'expense', 5),
        ('Restaurants & Coffee', 'expense', 6),
        ('Transportation', 'expense', 7),
        ('Car', 'expense', 8),
        ('Healthcare', 'expense', 9),
        ('Insurance', 'expense', 10),
        ('Debt Payment', 'expense', 11),
        ('Subscriptions', 'expense', 12),
        ('Shopping', 'expense', 13),
        ('Personal Care', 'expense', 14),
        ('Entertainment', 'expense', 15),
        ('Travel', 'expense', 16),
        ('Education', 'expense', 17),
        ('Gifts/Donations', 'expense', 18),
        ('Fees & Taxes', 'expense', 19),
        ('Needs Review', 'expense', 20);

    CREATE TEMP TABLE category_name_map (
        old_name TEXT PRIMARY KEY,
        new_name TEXT NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO category_name_map (old_name, new_name) VALUES
        ('income', 'Income'),
        ('wages & salary', 'Income'),
        ('investment income', 'Income'),
        ('other income', 'Income'),
        ('transfer', 'Transfer'),
        ('transfers', 'Transfer'),
        ('housing', 'Housing'),
        ('rent/mortgage', 'Housing'),
        ('mortgage', 'Housing'),
        ('property taxes', 'Fees & Taxes'),
        ('utilities', 'Utilities'),
        ('home maintenance', 'Housing'),
        ('food', 'Groceries'),
        ('food & dining', 'Restaurants & Coffee'),
        ('groceries', 'Groceries'),
        ('restaurants', 'Restaurants & Coffee'),
        ('coffee shops', 'Restaurants & Coffee'),
        ('alcohol & bars', 'Restaurants & Coffee'),
        ('transportation', 'Transportation'),
        ('gas', 'Car'),
        ('public transit', 'Transportation'),
        ('parking', 'Transportation'),
        ('car maintenance', 'Car'),
        ('car insurance', 'Insurance'),
        ('shopping', 'Shopping'),
        ('general shopping', 'Shopping'),
        ('clothing', 'Shopping'),
        ('electronics', 'Shopping'),
        ('entertainment', 'Entertainment'),
        ('movies & tv', 'Entertainment'),
        ('concerts & events', 'Entertainment'),
        ('hobbies', 'Entertainment'),
        ('sports & recreation', 'Entertainment'),
        ('subscriptions', 'Subscriptions'),
        ('streaming services', 'Subscriptions'),
        ('software subscriptions', 'Subscriptions'),
        ('gym & fitness', 'Subscriptions'),
        ('other subscriptions', 'Subscriptions'),
        ('healthcare', 'Healthcare'),
        ('doctor visits', 'Healthcare'),
        ('pharmacy', 'Healthcare'),
        ('health insurance', 'Insurance'),
        ('dental', 'Healthcare'),
        ('personal care', 'Personal Care'),
        ('hair & beauty', 'Personal Care'),
        ('personal hygiene', 'Personal Care'),
        ('debt payment', 'Debt Payment'),
        ('credit card payment', 'Debt Payment'),
        ('loan payment', 'Debt Payment'),
        ('student loan', 'Debt Payment'),
        ('education', 'Education'),
        ('tuition', 'Education'),
        ('books & supplies', 'Education'),
        ('gifts & donations', 'Gifts/Donations'),
        ('gifts', 'Gifts/Donations'),
        ('charity', 'Gifts/Donations'),
        ('other expenses', 'Needs Review'),
        ('bank fees', 'Fees & Taxes'),
        ('taxes', 'Fees & Taxes'),
        ('uncategorized', 'Needs Review'),
        ('needs review', 'Needs Review'),
        ('travel', 'Travel');

    FOR u IN
        SELECT DISTINCT user_id
        FROM public.categories
        WHERE user_id IS NOT NULL
    LOOP
        -- Ensure each user has all canonical categories.
        INSERT INTO public.categories (id, name, kind, parent_id, type, user_id, sort_order, is_archived)
        SELECT gen_random_uuid(), c.name, 'category', NULL, c.type, u.user_id, c.sort_order, false
        FROM canonical_categories c
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.categories existing
            WHERE existing.user_id = u.user_id
              AND existing.kind = 'category'
              AND lower(existing.name) = lower(c.name)
        );

        SELECT id INTO needs_review_id
        FROM public.categories
        WHERE user_id = u.user_id
          AND kind = 'category'
          AND lower(name) = 'needs review'
        ORDER BY id
        LIMIT 1;

        -- Build best target category id per canonical name for this user.
        CREATE TEMP TABLE user_targets ON COMMIT DROP AS
        SELECT DISTINCT ON (lower(c.name))
            lower(c.name) AS name_lc,
            c.id AS category_id
        FROM public.categories c
        JOIN canonical_categories cc ON lower(cc.name) = lower(c.name)
        WHERE c.user_id = u.user_id
          AND c.kind = 'category'
        ORDER BY lower(c.name), c.id;

        -- Map via explicit name mapping for transactions.
        UPDATE public.transactions t
        SET category_id = ut.category_id
        FROM public.categories oldc
        JOIN category_name_map nm
          ON lower(oldc.name) = nm.old_name
        JOIN user_targets ut
          ON ut.name_lc = lower(nm.new_name)
        WHERE t.user_id = u.user_id
          AND t.category_id = oldc.id;

        -- Fallback any non-canonical category ids to Needs Review.
        UPDATE public.transactions t
        SET category_id = needs_review_id
        FROM public.categories oldc
        WHERE t.user_id = u.user_id
          AND t.category_id = oldc.id
          AND oldc.user_id = u.user_id
          AND oldc.kind = 'category'
          AND lower(oldc.name) NOT IN (SELECT lower(name) FROM canonical_categories)
          AND needs_review_id IS NOT NULL;

        -- Remap merchant mappings.
        UPDATE public.merchant_mappings mm
        SET category_id = ut.category_id
        FROM public.categories oldc
        JOIN category_name_map nm
          ON lower(oldc.name) = nm.old_name
        JOIN user_targets ut
          ON ut.name_lc = lower(nm.new_name)
        WHERE mm.user_id = u.user_id
          AND mm.category_id = oldc.id;

        UPDATE public.merchant_mappings mm
        SET category_id = needs_review_id
        FROM public.categories oldc
        WHERE mm.user_id = u.user_id
          AND mm.category_id = oldc.id
          AND oldc.user_id = u.user_id
          AND oldc.kind = 'category'
          AND lower(oldc.name) NOT IN (SELECT lower(name) FROM canonical_categories)
          AND needs_review_id IS NOT NULL;

        -- Remap category rules.
        UPDATE public.category_rules cr
        SET category_id = ut.category_id
        FROM public.categories oldc
        JOIN category_name_map nm
          ON lower(oldc.name) = nm.old_name
        JOIN user_targets ut
          ON ut.name_lc = lower(nm.new_name)
        WHERE cr.user_id = u.user_id
          AND cr.category_id = oldc.id;

        UPDATE public.category_rules cr
        SET category_id = needs_review_id
        FROM public.categories oldc
        WHERE cr.user_id = u.user_id
          AND cr.category_id = oldc.id
          AND oldc.user_id = u.user_id
          AND oldc.kind = 'category'
          AND lower(oldc.name) NOT IN (SELECT lower(name) FROM canonical_categories)
          AND needs_review_id IS NOT NULL;

        -- Remap recurring items.
        UPDATE public.recurring_items ri
        SET category_id = ut.category_id
        FROM public.categories oldc
        JOIN category_name_map nm
          ON lower(oldc.name) = nm.old_name
        JOIN user_targets ut
          ON ut.name_lc = lower(nm.new_name)
        WHERE ri.user_id = u.user_id
          AND ri.category_id = oldc.id;

        UPDATE public.recurring_items ri
        SET category_id = needs_review_id
        FROM public.categories oldc
        WHERE ri.user_id = u.user_id
          AND ri.category_id = oldc.id
          AND oldc.user_id = u.user_id
          AND oldc.kind = 'category'
          AND lower(oldc.name) NOT IN (SELECT lower(name) FROM canonical_categories)
          AND needs_review_id IS NOT NULL;

        -- Keep canonical categories active; archive the rest of this user's category leaves.
        UPDATE public.categories c
        SET is_archived = false
        WHERE c.user_id = u.user_id
          AND c.kind = 'category'
          AND lower(c.name) IN (SELECT lower(name) FROM canonical_categories);

        UPDATE public.categories c
        SET is_archived = true
        WHERE c.user_id = u.user_id
          AND c.kind = 'category'
          AND lower(c.name) NOT IN (SELECT lower(name) FROM canonical_categories);

        DROP TABLE IF EXISTS user_targets;
    END LOOP;
END $$;
