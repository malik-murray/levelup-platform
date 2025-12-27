-- Migration: Add account transfer support to transactions table
-- This allows tracking transfers between accounts without affecting income/expense totals
-- Based on task: ai/tasks/003-add-account-transfers.md

-- Add is_transfer column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN NOT NULL DEFAULT false;

-- Add transfer_group_id column to link related transfer transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS transfer_group_id UUID;

-- Create index for faster queries on transfer groups
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id ON transactions(transfer_group_id);

-- Create index for filtering transfers
CREATE INDEX IF NOT EXISTS idx_transactions_is_transfer ON transactions(is_transfer);











