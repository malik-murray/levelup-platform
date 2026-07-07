-- Migration: Market data cache + API usage tracking
-- Backs the real (Alpha Vantage / Binance) market data providers introduced
-- in src/lib/markets/dataCache.ts. Alpha Vantage's free tier is 25
-- requests/day, so quotes/candles/fundamentals are cached here and only
-- refreshed by the server-side API routes and the market-data-refresh cron
-- (never queried directly by the client). Shared across all users -- not
-- per-user data, so no user_id and RLS has no policies (service role only).

CREATE TABLE IF NOT EXISTS market_data_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticker TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'etf')),
    data_type TEXT NOT NULL CHECK (data_type IN ('quote', 'candles', 'fundamentals')),
    timeframe TEXT NOT NULL DEFAULT '', -- e.g. '1D', '1W' for candles; '' for quote/fundamentals

    payload JSONB NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('alpha_vantage', 'binance', 'mock')),

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(ticker, data_type, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_market_data_cache_ticker
    ON market_data_cache(ticker);

-- Tracks daily call counts per provider so the cache wrapper can stay under
-- Alpha Vantage's rate limit. One row per provider per day.
CREATE TABLE IF NOT EXISTS market_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    call_count INTEGER NOT NULL DEFAULT 0,

    UNIQUE(provider, usage_date)
);

ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_api_usage ENABLE ROW LEVEL SECURITY;

-- No policies -- these tables are shared cache/metering state, never read or
-- written by client-side Supabase calls. Only the service-role client used
-- in API routes / cron (which bypasses RLS) touches them.
