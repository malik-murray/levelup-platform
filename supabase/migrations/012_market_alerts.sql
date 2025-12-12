-- Migration: Add market alerts system
-- Creates market_alerts table and adds ETH swing alerts setting

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS market_alerts CASCADE;

-- Table: market_alerts
-- Stores alerts for tier changes (e.g., Strong Buy / Strong Sell)
CREATE TABLE market_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('Strong Buy', 'Buy', 'Neutral', 'Take Profit', 'Strong Sell', 'High-Risk Avoid')),
    buy_score NUMERIC(3, 1) NOT NULL CHECK (buy_score >= 0 AND buy_score <= 10),
    sell_score NUMERIC(3, 1) NOT NULL CHECK (sell_score >= 0 AND sell_score <= 10),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    market_regime TEXT NOT NULL CHECK (market_regime IN ('bull', 'bear', 'range')),
    current_price NUMERIC(18, 4) NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add eth_swing_alerts_enabled column to market_user_settings
ALTER TABLE market_user_settings 
ADD COLUMN IF NOT EXISTS eth_swing_alerts_enabled BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_alerts_user_id ON market_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_market_alerts_ticker ON market_alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_market_alerts_created_at ON market_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_market_alerts_read ON market_alerts(read);

-- Enable Row Level Security (RLS)
ALTER TABLE market_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own alerts
DROP POLICY IF EXISTS "Users can manage their own alerts" ON market_alerts;
CREATE POLICY "Users can manage their own alerts"
    ON market_alerts FOR ALL
    USING (auth.uid() = user_id);





