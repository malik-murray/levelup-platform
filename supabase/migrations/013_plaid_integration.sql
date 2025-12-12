-- Migration: Add Plaid integration support
-- This allows connecting bank accounts via Plaid and syncing transactions

-- Create plaid_items table to store Plaid access tokens
CREATE TABLE IF NOT EXISTS plaid_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL UNIQUE, -- Plaid item_id
    access_token TEXT NOT NULL, -- Encrypted Plaid access token (should be encrypted in production)
    institution_id TEXT, -- Plaid institution ID
    institution_name TEXT, -- Bank name
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_successful_update TIMESTAMPTZ, -- Last time we successfully synced
    error_code TEXT, -- Plaid error code if any
    error_message TEXT -- Plaid error message if any
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON plaid_items(item_id);

-- Add plaid_account_id to accounts table to link to Plaid accounts
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS plaid_account_id TEXT UNIQUE; -- Plaid account_id

-- Add plaid_item_id to accounts to link to the Plaid item
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS plaid_item_id UUID REFERENCES plaid_items(id) ON DELETE SET NULL;

-- Add index for Plaid account lookups
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_account_id ON accounts(plaid_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_item_id ON accounts(plaid_item_id);

-- Add plaid_transaction_id to transactions table to avoid duplicates
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT UNIQUE; -- Plaid transaction_id

-- Add index for Plaid transaction lookups
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_transaction_id ON transactions(plaid_transaction_id);

-- Add sync metadata to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS synced_from_plaid BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering synced transactions
CREATE INDEX IF NOT EXISTS idx_transactions_synced_from_plaid ON transactions(synced_from_plaid);

-- Enable RLS (Row Level Security) on plaid_items
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own Plaid items
CREATE POLICY "Users can view their own plaid items"
    ON plaid_items FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own Plaid items
CREATE POLICY "Users can insert their own plaid items"
    ON plaid_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own Plaid items
CREATE POLICY "Users can update their own plaid items"
    ON plaid_items FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own Plaid items
CREATE POLICY "Users can delete their own plaid items"
    ON plaid_items FOR DELETE
    USING (auth.uid() = user_id);



