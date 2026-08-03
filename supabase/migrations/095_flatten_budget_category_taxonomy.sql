-- Flatten finance categories to a two-level Group → Subcategory taxonomy for all users.
-- Strategy:
-- 1) Ensure canonical groups + leaves per user (incl. Transfer, Savings/Investing, Needs Review).
-- 2) Remap transactions, category_budgets (merge-sum), budget_items (merge), merchant_mappings,
--    category_rules, recurring_items onto canonical leaves.
-- 3) Archive non-canonical categories/groups (soft delete via is_archived).

ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_categories_user_archived
    ON public.categories(user_id, is_archived);

DO $$
DECLARE
    u RECORD;
    g_income UUID;
    g_bills UUID;
    g_food UUID;
    g_entertainment UUID;
    g_education UUID;
    g_gifts UUID;
    g_transfer UUID;
    g_savings UUID;
    leaf_rec RECORD;
    grp_id UUID;
BEGIN
    -- Canonical groups: name, type, sort_order
    CREATE TEMP TABLE canonical_groups (
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        PRIMARY KEY (name, type)
    ) ON COMMIT DROP;

    INSERT INTO canonical_groups (name, type, sort_order) VALUES
        ('Income', 'income', 10),
        ('Bills', 'expense', 20),
        ('Food', 'expense', 30),
        ('Entertainment', 'expense', 40),
        ('Education', 'expense', 50),
        ('Gifts', 'expense', 60),
        ('Transfer', 'expense', 70),
        ('Savings/Investing', 'transfer', 80);

    -- Canonical leaves: group_name, leaf_name, leaf_type, sort_order
    CREATE TEMP TABLE canonical_leaves (
        group_name TEXT NOT NULL,
        group_type TEXT NOT NULL,
        leaf_name TEXT NOT NULL,
        leaf_type TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        PRIMARY KEY (group_name, group_type, leaf_name, leaf_type)
    ) ON COMMIT DROP;

    INSERT INTO canonical_leaves (group_name, group_type, leaf_name, leaf_type, sort_order) VALUES
        -- Income
        ('Income', 'income', 'Job 1', 'income', 1),
        ('Income', 'income', 'Job 2', 'income', 2),
        ('Income', 'income', 'Dividend/Interest', 'income', 3),
        ('Income', 'income', 'Investments', 'income', 4),
        ('Income', 'income', 'Gifts', 'income', 5),
        -- Bills
        ('Bills', 'expense', 'Rent', 'expense', 1),
        ('Bills', 'expense', 'Utilities', 'expense', 2),
        ('Bills', 'expense', 'Phone', 'expense', 3),
        ('Bills', 'expense', 'Wi-Fi', 'expense', 4),
        ('Bills', 'expense', 'Insurance', 'expense', 5),
        ('Bills', 'expense', 'Subscriptions', 'expense', 6),
        ('Bills', 'expense', 'Transportation', 'expense', 7),
        ('Bills', 'expense', 'Health/Fitness', 'expense', 8),
        ('Bills', 'expense', 'Business', 'expense', 9),
        ('Bills', 'expense', 'Child Support', 'expense', 10),
        ('Bills', 'expense', 'Needs Review', 'expense', 99),
        -- Food
        ('Food', 'expense', 'Groceries', 'expense', 1),
        ('Food', 'expense', 'Dining Out', 'expense', 2),
        ('Food', 'expense', 'CarryOut', 'expense', 3),
        ('Food', 'expense', 'Snacks', 'expense', 4),
        -- Entertainment / Education / Gifts (single leaf under each group)
        ('Entertainment', 'expense', 'Entertainment', 'expense', 1),
        ('Education', 'expense', 'Education', 'expense', 1),
        ('Gifts', 'expense', 'Gifts', 'expense', 1),
        -- Transfer
        ('Transfer', 'expense', 'Transfer', 'expense', 1),
        -- Savings/Investing
        ('Savings/Investing', 'transfer', 'Savings', 'transfer', 1),
        ('Savings/Investing', 'transfer', 'Investments', 'transfer', 2);

    -- old_name (lower), optional old_type (NULL = any), → new group/leaf/type
    CREATE TEMP TABLE category_name_map (
        old_name TEXT NOT NULL,
        old_type TEXT,
        new_group TEXT NOT NULL,
        new_group_type TEXT NOT NULL,
        new_leaf TEXT NOT NULL,
        new_leaf_type TEXT NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO category_name_map
        (old_name, old_type, new_group, new_group_type, new_leaf, new_leaf_type)
    VALUES
        -- Income
        ('income', NULL, 'Income', 'income', 'Job 1', 'income'),
        ('job 1', NULL, 'Income', 'income', 'Job 1', 'income'),
        ('job 2', NULL, 'Income', 'income', 'Job 2', 'income'),
        ('wages & salary', NULL, 'Income', 'income', 'Job 1', 'income'),
        ('salary', NULL, 'Income', 'income', 'Job 1', 'income'),
        ('wages', NULL, 'Income', 'income', 'Job 1', 'income'),
        ('job', NULL, 'Income', 'income', 'Job 1', 'income'),
        ('freelance', NULL, 'Income', 'income', 'Job 2', 'income'),
        ('side hustle', NULL, 'Income', 'income', 'Job 2', 'income'),
        ('side income', NULL, 'Income', 'income', 'Job 2', 'income'),
        ('other income', NULL, 'Income', 'income', 'Job 2', 'income'),
        ('investment income', NULL, 'Income', 'income', 'Dividend/Interest', 'income'),
        ('dividends', NULL, 'Income', 'income', 'Dividend/Interest', 'income'),
        ('dividend/interest', NULL, 'Income', 'income', 'Dividend/Interest', 'income'),
        ('interest', NULL, 'Income', 'income', 'Dividend/Interest', 'income'),
        ('interest earned', NULL, 'Income', 'income', 'Dividend/Interest', 'income'),
        ('investments', 'income', 'Income', 'income', 'Investments', 'income'),
        ('gifts', 'income', 'Income', 'income', 'Gifts', 'income'),
        -- Bills / housing / utilities
        ('housing', NULL, 'Bills', 'expense', 'Rent', 'expense'),
        ('rent', NULL, 'Bills', 'expense', 'Rent', 'expense'),
        ('rent/mortgage', NULL, 'Bills', 'expense', 'Rent', 'expense'),
        ('mortgage', NULL, 'Bills', 'expense', 'Rent', 'expense'),
        ('home maintenance', NULL, 'Bills', 'expense', 'Rent', 'expense'),
        ('utilities', NULL, 'Bills', 'expense', 'Utilities', 'expense'),
        ('electricity', NULL, 'Bills', 'expense', 'Utilities', 'expense'),
        ('water', NULL, 'Bills', 'expense', 'Utilities', 'expense'),
        ('gas bill', NULL, 'Bills', 'expense', 'Utilities', 'expense'),
        ('phone', NULL, 'Bills', 'expense', 'Phone', 'expense'),
        ('telephone', NULL, 'Bills', 'expense', 'Phone', 'expense'),
        ('wi-fi', NULL, 'Bills', 'expense', 'Wi-Fi', 'expense'),
        ('wifi', NULL, 'Bills', 'expense', 'Wi-Fi', 'expense'),
        ('internet', NULL, 'Bills', 'expense', 'Wi-Fi', 'expense'),
        ('cable', NULL, 'Bills', 'expense', 'Wi-Fi', 'expense'),
        ('internet and cable', NULL, 'Bills', 'expense', 'Wi-Fi', 'expense'),
        ('insurance', NULL, 'Bills', 'expense', 'Insurance', 'expense'),
        ('car insurance', NULL, 'Bills', 'expense', 'Insurance', 'expense'),
        ('health insurance', NULL, 'Bills', 'expense', 'Insurance', 'expense'),
        ('home insurance', NULL, 'Bills', 'expense', 'Insurance', 'expense'),
        ('subscriptions', NULL, 'Bills', 'expense', 'Subscriptions', 'expense'),
        ('streaming services', NULL, 'Bills', 'expense', 'Subscriptions', 'expense'),
        ('software subscriptions', NULL, 'Bills', 'expense', 'Subscriptions', 'expense'),
        ('other subscriptions', NULL, 'Bills', 'expense', 'Subscriptions', 'expense'),
        ('transportation', NULL, 'Bills', 'expense', 'Transportation', 'expense'),
        ('car', NULL, 'Bills', 'expense', 'Transportation', 'expense'),
        ('gas', NULL, 'Bills', 'expense', 'Transportation', 'expense'),
        ('parking', NULL, 'Bills', 'expense', 'Transportation', 'expense'),
        ('public transit', NULL, 'Bills', 'expense', 'Transportation', 'expense'),
        ('car maintenance', NULL, 'Bills', 'expense', 'Transportation', 'expense'),
        ('travel', NULL, 'Bills', 'expense', 'Transportation', 'expense'),
        ('healthcare', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('health/fitness', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('doctor visits', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('pharmacy', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('dental', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('personal care', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('hair & beauty', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('personal hygiene', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('gym & fitness', NULL, 'Bills', 'expense', 'Health/Fitness', 'expense'),
        ('business', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('fees & taxes', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('bank fees', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('taxes', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('property taxes', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('debt payment', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('credit card payment', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('loan payment', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('student loan', NULL, 'Bills', 'expense', 'Business', 'expense'),
        ('child support', NULL, 'Bills', 'expense', 'Child Support', 'expense'),
        ('needs review', NULL, 'Bills', 'expense', 'Needs Review', 'expense'),
        ('uncategorized', NULL, 'Bills', 'expense', 'Needs Review', 'expense'),
        ('other expenses', NULL, 'Bills', 'expense', 'Needs Review', 'expense'),
        -- Food
        ('food', NULL, 'Food', 'expense', 'Groceries', 'expense'),
        ('food & dining', NULL, 'Food', 'expense', 'Dining Out', 'expense'),
        ('groceries', NULL, 'Food', 'expense', 'Groceries', 'expense'),
        ('dining out', NULL, 'Food', 'expense', 'Dining Out', 'expense'),
        ('restaurants', NULL, 'Food', 'expense', 'Dining Out', 'expense'),
        ('restaurants & coffee', NULL, 'Food', 'expense', 'Dining Out', 'expense'),
        ('coffee shops', NULL, 'Food', 'expense', 'Dining Out', 'expense'),
        ('alcohol & bars', NULL, 'Food', 'expense', 'Dining Out', 'expense'),
        ('carryout', NULL, 'Food', 'expense', 'CarryOut', 'expense'),
        ('carry out', NULL, 'Food', 'expense', 'CarryOut', 'expense'),
        ('takeout', NULL, 'Food', 'expense', 'CarryOut', 'expense'),
        ('delivery', NULL, 'Food', 'expense', 'CarryOut', 'expense'),
        ('snacks', NULL, 'Food', 'expense', 'Snacks', 'expense'),
        -- Entertainment
        ('entertainment', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('movies & tv', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('concerts & events', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('hobbies', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('sports & recreation', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('shopping', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('general shopping', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('clothing', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        ('electronics', NULL, 'Entertainment', 'expense', 'Entertainment', 'expense'),
        -- Education
        ('education', NULL, 'Education', 'expense', 'Education', 'expense'),
        ('tuition', NULL, 'Education', 'expense', 'Education', 'expense'),
        ('books & supplies', NULL, 'Education', 'expense', 'Education', 'expense'),
        -- Expense gifts
        ('gifts', 'expense', 'Gifts', 'expense', 'Gifts', 'expense'),
        ('gifts/donations', NULL, 'Gifts', 'expense', 'Gifts', 'expense'),
        ('gifts & donations', NULL, 'Gifts', 'expense', 'Gifts', 'expense'),
        ('charity', NULL, 'Gifts', 'expense', 'Gifts', 'expense'),
        ('donations', NULL, 'Gifts', 'expense', 'Gifts', 'expense'),
        -- Transfer
        ('transfer', NULL, 'Transfer', 'expense', 'Transfer', 'expense'),
        ('transfers', NULL, 'Transfer', 'expense', 'Transfer', 'expense'),
        -- Savings / investing contributions
        ('savings', NULL, 'Savings/Investing', 'transfer', 'Savings', 'transfer'),
        ('emergency fund', NULL, 'Savings/Investing', 'transfer', 'Savings', 'transfer'),
        ('savings/investing', NULL, 'Savings/Investing', 'transfer', 'Savings', 'transfer'),
        ('investments', 'transfer', 'Savings/Investing', 'transfer', 'Investments', 'transfer'),
        ('investments', 'expense', 'Savings/Investing', 'transfer', 'Investments', 'transfer'),
        ('investments', NULL, 'Savings/Investing', 'transfer', 'Investments', 'transfer');

    FOR u IN
        SELECT DISTINCT user_id
        FROM (
            SELECT user_id FROM public.categories WHERE user_id IS NOT NULL
            UNION
            SELECT user_id FROM public.transactions WHERE user_id IS NOT NULL
            UNION
            SELECT user_id FROM public.category_budgets WHERE user_id IS NOT NULL
        ) users
    LOOP
        -- Ensure groups
        INSERT INTO public.categories (id, name, kind, parent_id, type, user_id, sort_order, is_archived)
        SELECT gen_random_uuid(), g.name, 'group', NULL, g.type, u.user_id, g.sort_order, false
        FROM canonical_groups g
        WHERE NOT EXISTS (
            SELECT 1 FROM public.categories existing
            WHERE existing.user_id = u.user_id
              AND existing.kind = 'group'
              AND lower(existing.name) = lower(g.name)
              AND coalesce(existing.type, '') = g.type
        );

        -- Un-archive / fix sort on groups
        UPDATE public.categories c
        SET is_archived = false,
            sort_order = g.sort_order,
            type = g.type,
            parent_id = NULL,
            kind = 'group'
        FROM canonical_groups g
        WHERE c.user_id = u.user_id
          AND c.kind = 'group'
          AND lower(c.name) = lower(g.name)
          AND coalesce(c.type, g.type) = g.type;

        -- Resolve group ids
        SELECT id INTO g_income FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'income' AND type = 'income'
        ORDER BY id LIMIT 1;
        SELECT id INTO g_bills FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'bills' AND type = 'expense'
        ORDER BY id LIMIT 1;
        SELECT id INTO g_food FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'food' AND type = 'expense'
        ORDER BY id LIMIT 1;
        SELECT id INTO g_entertainment FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'entertainment' AND type = 'expense'
        ORDER BY id LIMIT 1;
        SELECT id INTO g_education FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'education' AND type = 'expense'
        ORDER BY id LIMIT 1;
        SELECT id INTO g_gifts FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'gifts' AND type = 'expense'
        ORDER BY id LIMIT 1;
        SELECT id INTO g_transfer FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'transfer' AND type = 'expense'
        ORDER BY id LIMIT 1;
        SELECT id INTO g_savings FROM public.categories
        WHERE user_id = u.user_id AND kind = 'group' AND lower(name) = 'savings/investing' AND type = 'transfer'
        ORDER BY id LIMIT 1;

        -- Ensure leaves under correct parents
        FOR leaf_rec IN SELECT * FROM canonical_leaves LOOP
            SELECT CASE leaf_rec.group_name
                WHEN 'Income' THEN g_income
                WHEN 'Bills' THEN g_bills
                WHEN 'Food' THEN g_food
                WHEN 'Entertainment' THEN g_entertainment
                WHEN 'Education' THEN g_education
                WHEN 'Gifts' THEN g_gifts
                WHEN 'Transfer' THEN g_transfer
                WHEN 'Savings/Investing' THEN g_savings
            END INTO grp_id;

            IF grp_id IS NULL THEN
                CONTINUE;
            END IF;

            -- Prefer an existing leaf with same name+type for this user (any parent); reparent it.
            IF EXISTS (
                SELECT 1 FROM public.categories
                WHERE user_id = u.user_id
                  AND kind = 'category'
                  AND lower(name) = lower(leaf_rec.leaf_name)
                  AND coalesce(type, '') = leaf_rec.leaf_type
            ) THEN
                UPDATE public.categories
                SET parent_id = grp_id,
                    sort_order = leaf_rec.sort_order,
                    is_archived = false,
                    type = leaf_rec.leaf_type,
                    kind = 'category'
                WHERE id = (
                    SELECT id FROM public.categories
                    WHERE user_id = u.user_id
                      AND kind = 'category'
                      AND lower(name) = lower(leaf_rec.leaf_name)
                      AND coalesce(type, '') = leaf_rec.leaf_type
                    ORDER BY
                        CASE WHEN parent_id = grp_id THEN 0 ELSE 1 END,
                        id
                    LIMIT 1
                );
            ELSE
                INSERT INTO public.categories (id, name, kind, parent_id, type, user_id, sort_order, is_archived)
                VALUES (
                    gen_random_uuid(),
                    leaf_rec.leaf_name,
                    'category',
                    grp_id,
                    leaf_rec.leaf_type,
                    u.user_id,
                    leaf_rec.sort_order,
                    false
                );
            END IF;
        END LOOP;

        -- Targets: one leaf id per (group, leaf, type)
        CREATE TEMP TABLE user_targets ON COMMIT DROP AS
        SELECT DISTINCT ON (cl.group_name, cl.leaf_name, cl.leaf_type)
            cl.group_name,
            cl.group_type,
            cl.leaf_name,
            cl.leaf_type,
            c.id AS category_id
        FROM canonical_leaves cl
        JOIN public.categories g
          ON g.user_id = u.user_id
         AND g.kind = 'group'
         AND lower(g.name) = lower(cl.group_name)
         AND coalesce(g.type, '') = cl.group_type
        JOIN public.categories c
          ON c.user_id = u.user_id
         AND c.kind = 'category'
         AND lower(c.name) = lower(cl.leaf_name)
         AND coalesce(c.type, '') = cl.leaf_type
         AND c.parent_id = g.id
        ORDER BY cl.group_name, cl.leaf_name, cl.leaf_type, c.id;

        -- Helper view of old→new category id for this user (best type-specific map wins)
        CREATE TEMP TABLE user_remap ON COMMIT DROP AS
        SELECT DISTINCT ON (oldc.id)
            oldc.id AS old_id,
            ut.category_id AS new_id
        FROM public.categories oldc
        JOIN category_name_map nm
          ON lower(oldc.name) = nm.old_name
         AND (nm.old_type IS NULL OR nm.old_type = coalesce(oldc.type, nm.old_type))
        JOIN user_targets ut
          ON lower(ut.group_name) = lower(nm.new_group)
         AND ut.group_type = nm.new_group_type
         AND lower(ut.leaf_name) = lower(nm.new_leaf)
         AND ut.leaf_type = nm.new_leaf_type
        WHERE oldc.user_id = u.user_id
          AND oldc.kind = 'category'
        ORDER BY oldc.id,
            CASE WHEN nm.old_type IS NOT NULL AND nm.old_type = oldc.type THEN 0 ELSE 1 END;

        -- Fallback: any non-canonical leaf → Needs Review
        INSERT INTO user_remap (old_id, new_id)
        SELECT oldc.id, ut.category_id
        FROM public.categories oldc
        JOIN user_targets ut
          ON lower(ut.leaf_name) = 'needs review'
         AND ut.group_name = 'Bills'
        WHERE oldc.user_id = u.user_id
          AND oldc.kind = 'category'
          AND NOT EXISTS (
              SELECT 1 FROM user_targets t WHERE t.category_id = oldc.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM user_remap r WHERE r.old_id = oldc.id
          );

        -- Remap transactions
        UPDATE public.transactions t
        SET category_id = r.new_id
        FROM user_remap r
        WHERE t.user_id = u.user_id
          AND t.category_id = r.old_id
          AND r.old_id <> r.new_id;

        -- Merge category_budgets: multiple old leaves may collapse onto one (category_id, month).
        -- Aggregate first, delete remapped sources, then upsert onto the canonical leaf.
        CREATE TEMP TABLE cb_agg ON COMMIT DROP AS
        SELECT
            r.new_id AS category_id,
            src.month,
            SUM(src.amount) AS amount
        FROM public.category_budgets src
        JOIN user_remap r
          ON src.category_id = r.old_id
         AND r.old_id <> r.new_id
        WHERE src.user_id = u.user_id
        GROUP BY r.new_id, src.month;

        -- Fold in any amount already on the target leaf for the same month
        UPDATE cb_agg a
        SET amount = a.amount + t.amount
        FROM public.category_budgets t
        WHERE t.user_id = u.user_id
          AND t.category_id = a.category_id
          AND t.month = a.month;

        DELETE FROM public.category_budgets src
        USING user_remap r
        WHERE src.user_id = u.user_id
          AND src.category_id = r.old_id
          AND r.old_id <> r.new_id;

        UPDATE public.category_budgets t
        SET amount = a.amount
        FROM cb_agg a
        WHERE t.user_id = u.user_id
          AND t.category_id = a.category_id
          AND t.month = a.month;

        INSERT INTO public.category_budgets (id, user_id, category_id, month, amount)
        SELECT gen_random_uuid(), u.user_id, a.category_id, a.month, a.amount
        FROM cb_agg a
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.category_budgets t
            WHERE t.user_id = u.user_id
              AND t.category_id = a.category_id
              AND t.month = a.month
        );

        DROP TABLE IF EXISTS cb_agg;

        -- Merge budget_items when target already has the category on the same plan
        IF to_regclass('public.budget_items') IS NOT NULL THEN
            CREATE TEMP TABLE bi_agg ON COMMIT DROP AS
            SELECT
                src.budget_plan_id,
                r.new_id AS category_id,
                SUM(src.amount) AS amount,
                SUM(coalesce(src.guardrail_adjustment, 0)) AS guardrail_adjustment,
                MAX(src.user_override_amount) AS user_override_amount
            FROM public.budget_items src
            JOIN user_remap r
              ON src.category_id = r.old_id
             AND r.old_id <> r.new_id
            JOIN public.budget_plans bp
              ON bp.id = src.budget_plan_id
             AND bp.user_id = u.user_id
            GROUP BY src.budget_plan_id, r.new_id;

            UPDATE bi_agg a
            SET amount = a.amount + t.amount,
                guardrail_adjustment = a.guardrail_adjustment
                    + coalesce(t.guardrail_adjustment, 0),
                user_override_amount = coalesce(a.user_override_amount, t.user_override_amount)
            FROM public.budget_items t
            WHERE t.budget_plan_id = a.budget_plan_id
              AND t.category_id = a.category_id;

            DELETE FROM public.budget_items src
            USING user_remap r, public.budget_plans bp
            WHERE src.category_id = r.old_id
              AND r.old_id <> r.new_id
              AND bp.id = src.budget_plan_id
              AND bp.user_id = u.user_id;

            UPDATE public.budget_items t
            SET amount = a.amount,
                guardrail_adjustment = a.guardrail_adjustment,
                user_override_amount = a.user_override_amount
            FROM bi_agg a
            WHERE t.budget_plan_id = a.budget_plan_id
              AND t.category_id = a.category_id;

            INSERT INTO public.budget_items (
                id, budget_plan_id, category_id, amount, guardrail_adjustment, user_override_amount
            )
            SELECT
                gen_random_uuid(),
                a.budget_plan_id,
                a.category_id,
                a.amount,
                a.guardrail_adjustment,
                a.user_override_amount
            FROM bi_agg a
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.budget_items t
                WHERE t.budget_plan_id = a.budget_plan_id
                  AND t.category_id = a.category_id
            );

            DROP TABLE IF EXISTS bi_agg;
        END IF;

        -- merchant_mappings / category_rules / recurring_items
        IF to_regclass('public.merchant_mappings') IS NOT NULL THEN
            UPDATE public.merchant_mappings mm
            SET category_id = r.new_id
            FROM user_remap r
            WHERE mm.user_id = u.user_id
              AND mm.category_id = r.old_id
              AND r.old_id <> r.new_id;
        END IF;

        IF to_regclass('public.category_rules') IS NOT NULL THEN
            UPDATE public.category_rules cr
            SET category_id = r.new_id
            FROM user_remap r
            WHERE cr.user_id = u.user_id
              AND cr.category_id = r.old_id
              AND r.old_id <> r.new_id;
        END IF;

        IF to_regclass('public.recurring_items') IS NOT NULL THEN
            UPDATE public.recurring_items ri
            SET category_id = r.new_id
            FROM user_remap r
            WHERE ri.user_id = u.user_id
              AND ri.category_id = r.old_id
              AND r.old_id <> r.new_id;
        END IF;

        -- Activate canonical; archive everything else for this user
        UPDATE public.categories c
        SET is_archived = false
        WHERE c.user_id = u.user_id
          AND (
              c.id IN (SELECT category_id FROM user_targets)
              OR (
                  c.kind = 'group'
                  AND EXISTS (
                      SELECT 1 FROM canonical_groups g
                      WHERE lower(g.name) = lower(c.name)
                        AND g.type = coalesce(c.type, g.type)
                  )
              )
          );

        UPDATE public.categories c
        SET is_archived = true
        WHERE c.user_id = u.user_id
          AND c.id NOT IN (SELECT category_id FROM user_targets)
          AND NOT (
              c.kind = 'group'
              AND EXISTS (
                  SELECT 1 FROM canonical_groups g
                  WHERE lower(g.name) = lower(c.name)
                    AND g.type = coalesce(c.type, g.type)
              )
          );

        DROP TABLE IF EXISTS user_remap;
        DROP TABLE IF EXISTS user_targets;
    END LOOP;
END $$;
