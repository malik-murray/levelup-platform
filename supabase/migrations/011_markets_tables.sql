-- Migration: Create markets analyzer tables
-- This migration creates tables for positions, watchlist, signal logs, and user settings

-- Drop existing tables if they exist (to ensure clean state)
-- This will delete any existing data - only run if you're okay with that
DROP TABLE IF EXISTS market_positions CASCADE;
DROP TABLE IF EXISTS market_watchlist CASCADE;
DROP TABLE IF EXISTS market_signal_logs CASCADE;
DROP TABLE IF EXISTS market_user_settings CASCADE;

-- Table: market_positions
-- Stores user's tracked positions (stocks, crypto, ETFs)
CREATE TABLE market_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'etf')),
    quantity NUMERIC(18, 8) NOT NULL, -- Support fractional shares/crypto
    average_entry NUMERIC(18, 4) NOT NULL,
    current_price NUMERIC(18, 4), -- Cached current price
    notes TEXT,
    risk_tolerance TEXT CHECK (risk_tolerance IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

-- Table: market_watchlist
-- Stores tickers user wants to monitor
CREATE TABLE market_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'etf')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

-- Table: market_signal_logs
-- Stores analysis results for backtesting, ML, and accuracy tracking
CREATE TABLE market_signal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Optional: null for system-wide logs
    ticker TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'etf')),
    mode TEXT NOT NULL CHECK (mode IN ('long-term', 'swing', 'risk-only')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Scores
    buy_score NUMERIC(3, 1) NOT NULL CHECK (buy_score >= 0 AND buy_score <= 10),
    sell_score NUMERIC(3, 1) NOT NULL CHECK (sell_score >= 0 AND sell_score <= 10),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    -- Market context
    market_regime TEXT NOT NULL CHECK (market_regime IN ('bull', 'bear', 'range')),
    current_price NUMERIC(18, 4) NOT NULL,
    -- Explanations
    explanation TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    -- Layer breakdown (JSONB for flexibility)
    layer_breakdown JSONB NOT NULL,
    layer_outputs JSONB NOT NULL, -- Full layer outputs for analysis
    -- Inputs used
    inputs JSONB, -- Timeframes, weights, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: market_user_settings
-- Stores user preferences for the analyzer
CREATE TABLE market_user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_mode TEXT DEFAULT 'long-term' CHECK (default_mode IN ('long-term', 'swing', 'risk-only')),
    risk_tolerance TEXT DEFAULT 'medium' CHECK (risk_tolerance IN ('low', 'medium', 'high')),
    notifications_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_positions_user_id ON market_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_market_positions_ticker ON market_positions(ticker);
CREATE INDEX IF NOT EXISTS idx_market_watchlist_user_id ON market_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_market_watchlist_ticker ON market_watchlist(ticker);
CREATE INDEX IF NOT EXISTS idx_market_signal_logs_user_id ON market_signal_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_market_signal_logs_ticker ON market_signal_logs(ticker);
CREATE INDEX IF NOT EXISTS idx_market_signal_logs_timestamp ON market_signal_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_signal_logs_mode ON market_signal_logs(mode);
CREATE INDEX IF NOT EXISTS idx_market_user_settings_user_id ON market_user_settings(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE market_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_signal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
DROP POLICY IF EXISTS "Users can manage their own positions" ON market_positions;
CREATE POLICY "Users can manage their own positions"
    ON market_positions FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own watchlist" ON market_watchlist;
CREATE POLICY "Users can manage their own watchlist"
    ON market_watchlist FOR ALL
    USING (auth.uid() = user_id);

-- Signal logs: users can read their own logs, but also allow system-wide logs (where user_id is null)
DROP POLICY IF EXISTS "Users can view signal logs" ON market_signal_logs;
CREATE POLICY "Users can view signal logs"
    ON market_signal_logs FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert their own signal logs" ON market_signal_logs;
CREATE POLICY "Users can insert their own signal logs"
    ON market_signal_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own settings" ON market_user_settings;
CREATE POLICY "Users can manage their own settings"
    ON market_user_settings FOR ALL
    USING (auth.uid() = user_id);

