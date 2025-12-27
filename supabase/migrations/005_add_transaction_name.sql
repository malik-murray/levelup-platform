-- Migration: Add name field to transactions table
-- This allows transactions to have a clear name/description separate from person/note

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS name TEXT;

-- For existing transactions, populate name from person field if name is null
UPDATE transactions
SET name = person
WHERE name IS NULL AND person IS NOT NULL;

-- Create an index for faster searches on transaction names
CREATE INDEX IF NOT EXISTS idx_transactions_name ON transactions (name);











