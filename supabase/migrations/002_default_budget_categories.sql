-- Migration: Create default budget categories and groups
-- This migration inserts common categories that most everyday people use
-- Safe to run multiple times - uses INSERT ... ON CONFLICT DO NOTHING

-- First, insert the category groups (kind='group')
-- These are parent categories that will contain subcategories

-- Income Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0001-000000000001', 'Income', 'income', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Housing Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0002-000000000001', 'Housing', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Transportation Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0003-000000000001', 'Transportation', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Food Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0004-000000000001', 'Food & Dining', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Utilities Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0005-000000000001', 'Utilities', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Personal Care Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0006-000000000001', 'Personal Care', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Health & Fitness Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0007-000000000001', 'Health & Fitness', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Entertainment Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0008-000000000001', 'Entertainment', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Subscriptions Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0009-000000000001', 'Subscriptions', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Shopping Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0010-000000000001', 'Shopping', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Debt Payments Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0011-000000000001', 'Debt Payments', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Savings Group
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0012-000000000001', 'Savings', 'expense', 'group', NULL)
ON CONFLICT (id) DO NOTHING;

-- Now insert subcategories (kind='category') under each group

-- Income Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0001-000000000101', 'Salary', 'income', 'category', '00000000-0000-0000-0001-000000000001'),
    ('00000000-0000-0000-0001-000000000102', 'Freelance', 'income', 'category', '00000000-0000-0000-0001-000000000001'),
    ('00000000-0000-0000-0001-000000000103', 'Investment Income', 'income', 'category', '00000000-0000-0000-0001-000000000001'),
    ('00000000-0000-0000-0001-000000000104', 'Side Hustle', 'income', 'category', '00000000-0000-0000-0001-000000000001'),
    ('00000000-0000-0000-0001-000000000105', 'Other Income', 'income', 'category', '00000000-0000-0000-0001-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Housing Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0002-000000000101', 'Rent/Mortgage', 'expense', 'category', '00000000-0000-0000-0002-000000000001'),
    ('00000000-0000-0000-0002-000000000102', 'Home Insurance', 'expense', 'category', '00000000-0000-0000-0002-000000000001'),
    ('00000000-0000-0000-0002-000000000103', 'Property Taxes', 'expense', 'category', '00000000-0000-0000-0002-000000000001'),
    ('00000000-0000-0000-0002-000000000104', 'Home Maintenance', 'expense', 'category', '00000000-0000-0000-0002-000000000001'),
    ('00000000-0000-0000-0002-000000000105', 'Furnishing', 'expense', 'category', '00000000-0000-0000-0002-000000000001'),
    ('00000000-0000-0000-0002-000000000106', 'HOA Fees', 'expense', 'category', '00000000-0000-0000-0002-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Transportation Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0003-000000000101', 'Gas/Fuel', 'expense', 'category', '00000000-0000-0000-0003-000000000001'),
    ('00000000-0000-0000-0003-000000000102', 'Car Payment', 'expense', 'category', '00000000-0000-0000-0003-000000000001'),
    ('00000000-0000-0000-0003-000000000103', 'Car Insurance', 'expense', 'category', '00000000-0000-0000-0003-000000000001'),
    ('00000000-0000-0000-0003-000000000104', 'Car Maintenance', 'expense', 'category', '00000000-0000-0000-0003-000000000001'),
    ('00000000-0000-0000-0003-000000000105', 'Parking', 'expense', 'category', '00000000-0000-0000-0003-000000000001'),
    ('00000000-0000-0000-0003-000000000106', 'Tolls', 'expense', 'category', '00000000-0000-0000-0003-000000000001'),
    ('00000000-0000-0000-0003-000000000107', 'Public Transit', 'expense', 'category', '00000000-0000-0000-0003-000000000001'),
    ('00000000-0000-0000-0003-000000000108', 'Rideshare/Taxi', 'expense', 'category', '00000000-0000-0000-0003-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Food & Dining Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0004-000000000101', 'Groceries', 'expense', 'category', '00000000-0000-0000-0004-000000000001'),
    ('00000000-0000-0000-0004-000000000102', 'Restaurants', 'expense', 'category', '00000000-0000-0000-0004-000000000001'),
    ('00000000-0000-0000-0004-000000000103', 'Fast Food', 'expense', 'category', '00000000-0000-0000-0004-000000000001'),
    ('00000000-0000-0000-0004-000000000104', 'Coffee Shops', 'expense', 'category', '00000000-0000-0000-0004-000000000001'),
    ('00000000-0000-0000-0004-000000000105', 'Alcohol', 'expense', 'category', '00000000-0000-0000-0004-000000000001'),
    ('00000000-0000-0000-0004-000000000106', 'Delivery/Takeout', 'expense', 'category', '00000000-0000-0000-0004-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Utilities Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0005-000000000101', 'Electricity', 'expense', 'category', '00000000-0000-0000-0005-000000000001'),
    ('00000000-0000-0000-0005-000000000102', 'Water', 'expense', 'category', '00000000-0000-0000-0005-000000000001'),
    ('00000000-0000-0000-0005-000000000103', 'Gas/Heating', 'expense', 'category', '00000000-0000-0000-0005-000000000001'),
    ('00000000-0000-0000-0005-000000000104', 'Internet', 'expense', 'category', '00000000-0000-0000-0005-000000000001'),
    ('00000000-0000-0000-0005-000000000105', 'Phone', 'expense', 'category', '00000000-0000-0000-0005-000000000001'),
    ('00000000-0000-0000-0005-000000000106', 'Cable/TV', 'expense', 'category', '00000000-0000-0000-0005-000000000001'),
    ('00000000-0000-0000-0005-000000000107', 'Trash/Recycling', 'expense', 'category', '00000000-0000-0000-0005-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Personal Care Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0006-000000000101', 'Haircuts', 'expense', 'category', '00000000-0000-0000-0006-000000000001'),
    ('00000000-0000-0000-0006-000000000102', 'Toiletries', 'expense', 'category', '00000000-0000-0000-0006-000000000001'),
    ('00000000-0000-0000-0006-000000000103', 'Skincare', 'expense', 'category', '00000000-0000-0000-0006-000000000001'),
    ('00000000-0000-0000-0006-000000000104', 'Makeup', 'expense', 'category', '00000000-0000-0000-0006-000000000001'),
    ('00000000-0000-0000-0006-000000000105', 'Clothing', 'expense', 'category', '00000000-0000-0000-0006-000000000001'),
    ('00000000-0000-0000-0006-000000000106', 'Laundry', 'expense', 'category', '00000000-0000-0000-0006-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Health & Fitness Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0007-000000000101', 'Health Insurance', 'expense', 'category', '00000000-0000-0000-0007-000000000001'),
    ('00000000-0000-0000-0007-000000000102', 'Doctor Visits', 'expense', 'category', '00000000-0000-0000-0007-000000000001'),
    ('00000000-0000-0000-0007-000000000103', 'Dentist', 'expense', 'category', '00000000-0000-0000-0007-000000000001'),
    ('00000000-0000-0000-0007-000000000104', 'Pharmacy/Medications', 'expense', 'category', '00000000-0000-0000-0007-000000000001'),
    ('00000000-0000-0000-0007-000000000105', 'Gym Membership', 'expense', 'category', '00000000-0000-0000-0007-000000000001'),
    ('00000000-0000-0000-0007-000000000106', 'Fitness Classes', 'expense', 'category', '00000000-0000-0000-0007-000000000001'),
    ('00000000-0000-0000-0007-000000000107', 'Supplements', 'expense', 'category', '00000000-0000-0000-0007-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Entertainment Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0008-000000000101', 'Movies', 'expense', 'category', '00000000-0000-0000-0008-000000000001'),
    ('00000000-0000-0000-0008-000000000102', 'Concerts/Events', 'expense', 'category', '00000000-0000-0000-0008-000000000001'),
    ('00000000-0000-0000-0008-000000000103', 'Hobbies', 'expense', 'category', '00000000-0000-0000-0008-000000000001'),
    ('00000000-0000-0000-0008-000000000104', 'Games', 'expense', 'category', '00000000-0000-0000-0008-000000000001'),
    ('00000000-0000-0000-0008-000000000105', 'Books', 'expense', 'category', '00000000-0000-0000-0008-000000000001'),
    ('00000000-0000-0000-0008-000000000106', 'Sports', 'expense', 'category', '00000000-0000-0000-0008-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Subscriptions Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0009-000000000101', 'Netflix', 'expense', 'category', '00000000-0000-0000-0009-000000000001'),
    ('00000000-0000-0000-0009-000000000102', 'Spotify', 'expense', 'category', '00000000-0000-0000-0009-000000000001'),
    ('00000000-0000-0000-0009-000000000103', 'Amazon Prime', 'expense', 'category', '00000000-0000-0000-0009-000000000001'),
    ('00000000-0000-0000-0009-000000000104', 'Disney+', 'expense', 'category', '00000000-0000-0000-0009-000000000001'),
    ('00000000-0000-0000-0009-000000000105', 'Apple Services', 'expense', 'category', '00000000-0000-0000-0009-000000000001'),
    ('00000000-0000-0000-0009-000000000106', 'Software Subscriptions', 'expense', 'category', '00000000-0000-0000-0009-000000000001'),
    ('00000000-0000-0000-0009-000000000107', 'Other Subscriptions', 'expense', 'category', '00000000-0000-0000-0009-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Shopping Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0010-000000000101', 'Electronics', 'expense', 'category', '00000000-0000-0000-0010-000000000001'),
    ('00000000-0000-0000-0010-000000000102', 'Household Items', 'expense', 'category', '00000000-0000-0000-0010-000000000001'),
    ('00000000-0000-0000-0010-000000000103', 'Gifts', 'expense', 'category', '00000000-0000-0000-0010-000000000001'),
    ('00000000-0000-0000-0010-000000000104', 'Home Decor', 'expense', 'category', '00000000-0000-0000-0010-000000000001'),
    ('00000000-0000-0000-0010-000000000105', 'Online Shopping', 'expense', 'category', '00000000-0000-0000-0010-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Debt Payments Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0011-000000000101', 'Credit Card Payment', 'expense', 'category', '00000000-0000-0000-0011-000000000001'),
    ('00000000-0000-0000-0011-000000000102', 'Student Loans', 'expense', 'category', '00000000-0000-0000-0011-000000000001'),
    ('00000000-0000-0000-0011-000000000103', 'Personal Loans', 'expense', 'category', '00000000-0000-0000-0011-000000000001'),
    ('00000000-0000-0000-0011-000000000104', 'Other Debt', 'expense', 'category', '00000000-0000-0000-0011-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Savings Subcategories
INSERT INTO categories (id, name, type, kind, parent_id)
VALUES 
    ('00000000-0000-0000-0012-000000000101', 'Emergency Fund', 'expense', 'category', '00000000-0000-0000-0012-000000000001'),
    ('00000000-0000-0000-0012-000000000102', 'Vacation Fund', 'expense', 'category', '00000000-0000-0000-0012-000000000001'),
    ('00000000-0000-0000-0012-000000000103', 'Retirement Savings', 'expense', 'category', '00000000-0000-0000-0012-000000000001'),
    ('00000000-0000-0000-0012-000000000104', 'Investments', 'expense', 'category', '00000000-0000-0000-0012-000000000001'),
    ('00000000-0000-0000-0012-000000000105', 'Sinking Fund', 'expense', 'category', '00000000-0000-0000-0012-000000000001')
ON CONFLICT (id) DO NOTHING;



