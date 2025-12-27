-- Migration: Seed default financial categories for categorization engine
-- These are global categories that can be used by all users

-- Note: This assumes categories table already exists with user_id support
-- Categories can be user-specific (user_id set) or global (user_id NULL)

-- Expense Categories
INSERT INTO categories (id, name, kind, parent_id, type, user_id, sort_order)
VALUES 
    -- Income Groups
    (gen_random_uuid(), 'Income', 'group', NULL, 'income', NULL, 1),
    (gen_random_uuid(), 'Wages & Salary', 'category', (SELECT id FROM categories WHERE name = 'Income' AND user_id IS NULL LIMIT 1), 'income', NULL, 1),
    (gen_random_uuid(), 'Investment Income', 'category', (SELECT id FROM categories WHERE name = 'Income' AND user_id IS NULL LIMIT 1), 'income', NULL, 2),
    (gen_random_uuid(), 'Other Income', 'category', (SELECT id FROM categories WHERE name = 'Income' AND user_id IS NULL LIMIT 1), 'income', NULL, 3),

    -- Expense Groups
    (gen_random_uuid(), 'Housing', 'group', NULL, 'expense', NULL, 10),
    (gen_random_uuid(), 'Rent/Mortgage', 'category', (SELECT id FROM categories WHERE name = 'Housing' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Utilities', 'category', (SELECT id FROM categories WHERE name = 'Housing' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'Home Maintenance', 'category', (SELECT id FROM categories WHERE name = 'Housing' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),
    (gen_random_uuid(), 'Property Taxes', 'category', (SELECT id FROM categories WHERE name = 'Housing' AND user_id IS NULL LIMIT 1), 'expense', NULL, 4),

    (gen_random_uuid(), 'Food & Dining', 'group', NULL, 'expense', NULL, 20),
    (gen_random_uuid(), 'Groceries', 'category', (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Restaurants', 'category', (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'Coffee Shops', 'category', (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),
    (gen_random_uuid(), 'Alcohol & Bars', 'category', (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id IS NULL LIMIT 1), 'expense', NULL, 4),

    (gen_random_uuid(), 'Transportation', 'group', NULL, 'expense', NULL, 30),
    (gen_random_uuid(), 'Gas', 'category', (SELECT id FROM categories WHERE name = 'Transportation' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Public Transit', 'category', (SELECT id FROM categories WHERE name = 'Transportation' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'Parking', 'category', (SELECT id FROM categories WHERE name = 'Transportation' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),
    (gen_random_uuid(), 'Car Maintenance', 'category', (SELECT id FROM categories WHERE name = 'Transportation' AND user_id IS NULL LIMIT 1), 'expense', NULL, 4),
    (gen_random_uuid(), 'Car Insurance', 'category', (SELECT id FROM categories WHERE name = 'Transportation' AND user_id IS NULL LIMIT 1), 'expense', NULL, 5),

    (gen_random_uuid(), 'Shopping', 'group', NULL, 'expense', NULL, 40),
    (gen_random_uuid(), 'Clothing', 'category', (SELECT id FROM categories WHERE name = 'Shopping' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Electronics', 'category', (SELECT id FROM categories WHERE name = 'Shopping' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'General Shopping', 'category', (SELECT id FROM categories WHERE name = 'Shopping' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),

    (gen_random_uuid(), 'Entertainment', 'group', NULL, 'expense', NULL, 50),
    (gen_random_uuid(), 'Movies & TV', 'category', (SELECT id FROM categories WHERE name = 'Entertainment' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Concerts & Events', 'category', (SELECT id FROM categories WHERE name = 'Entertainment' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'Hobbies', 'category', (SELECT id FROM categories WHERE name = 'Entertainment' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),
    (gen_random_uuid(), 'Sports & Recreation', 'category', (SELECT id FROM categories WHERE name = 'Entertainment' AND user_id IS NULL LIMIT 1), 'expense', NULL, 4),

    (gen_random_uuid(), 'Subscriptions', 'group', NULL, 'expense', NULL, 60),
    (gen_random_uuid(), 'Streaming Services', 'category', (SELECT id FROM categories WHERE name = 'Subscriptions' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Software Subscriptions', 'category', (SELECT id FROM categories WHERE name = 'Subscriptions' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'Gym & Fitness', 'category', (SELECT id FROM categories WHERE name = 'Subscriptions' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),
    (gen_random_uuid(), 'Other Subscriptions', 'category', (SELECT id FROM categories WHERE name = 'Subscriptions' AND user_id IS NULL LIMIT 1), 'expense', NULL, 4),

    (gen_random_uuid(), 'Healthcare', 'group', NULL, 'expense', NULL, 70),
    (gen_random_uuid(), 'Doctor Visits', 'category', (SELECT id FROM categories WHERE name = 'Healthcare' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Pharmacy', 'category', (SELECT id FROM categories WHERE name = 'Healthcare' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'Health Insurance', 'category', (SELECT id FROM categories WHERE name = 'Healthcare' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),
    (gen_random_uuid(), 'Dental', 'category', (SELECT id FROM categories WHERE name = 'Healthcare' AND user_id IS NULL LIMIT 1), 'expense', NULL, 4),

    (gen_random_uuid(), 'Personal Care', 'group', NULL, 'expense', NULL, 80),
    (gen_random_uuid(), 'Hair & Beauty', 'category', (SELECT id FROM categories WHERE name = 'Personal Care' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Personal Hygiene', 'category', (SELECT id FROM categories WHERE name = 'Personal Care' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),

    (gen_random_uuid(), 'Debt Payment', 'group', NULL, 'expense', NULL, 90),
    (gen_random_uuid(), 'Credit Card Payment', 'category', (SELECT id FROM categories WHERE name = 'Debt Payment' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Loan Payment', 'category', (SELECT id FROM categories WHERE name = 'Debt Payment' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),
    (gen_random_uuid(), 'Student Loan', 'category', (SELECT id FROM categories WHERE name = 'Debt Payment' AND user_id IS NULL LIMIT 1), 'expense', NULL, 3),

    (gen_random_uuid(), 'Education', 'group', NULL, 'expense', NULL, 100),
    (gen_random_uuid(), 'Tuition', 'category', (SELECT id FROM categories WHERE name = 'Education' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Books & Supplies', 'category', (SELECT id FROM categories WHERE name = 'Education' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),

    (gen_random_uuid(), 'Gifts & Donations', 'group', NULL, 'expense', NULL, 110),
    (gen_random_uuid(), 'Gifts', 'category', (SELECT id FROM categories WHERE name = 'Gifts & Donations' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Charity', 'category', (SELECT id FROM categories WHERE name = 'Gifts & Donations' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2),

    (gen_random_uuid(), 'Other Expenses', 'group', NULL, 'expense', NULL, 120),
    (gen_random_uuid(), 'Bank Fees', 'category', (SELECT id FROM categories WHERE name = 'Other Expenses' AND user_id IS NULL LIMIT 1), 'expense', NULL, 1),
    (gen_random_uuid(), 'Uncategorized', 'category', (SELECT id FROM categories WHERE name = 'Other Expenses' AND user_id IS NULL LIMIT 1), 'expense', NULL, 2)
ON CONFLICT DO NOTHING;

-- Note: The above INSERT may need adjustment based on your categories table structure
-- If categories need to be user-specific, you would need to run this migration
-- for each user or copy these categories to user-specific ones




