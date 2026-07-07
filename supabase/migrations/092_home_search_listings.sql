-- Migration: Home Search listings
-- Stores daily ranked home-listing results produced by the external home-search
-- research task (see src/app/api/home-search/ingest/route.ts), so the Home Search
-- page can read them the same way other modules read cron-generated data.

CREATE TABLE IF NOT EXISTS home_search_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    run_date DATE NOT NULL,

    buy_signal_score SMALLINT CHECK (buy_signal_score BETWEEN 1 AND 10),
    buy_signal_rationale TEXT,

    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    home_type TEXT CHECK (home_type IN ('townhouse', 'single_family', 'condo')),
    built_year INTEGER,
    beds SMALLINT,
    baths NUMERIC(3, 1),

    price NUMERIC(12, 2) NOT NULL,
    hoa_monthly NUMERIC(8, 2),

    est_monthly_10pct_down NUMERIC(10, 2),
    est_monthly_with_dpa NUMERIC(10, 2),

    fits_budget TEXT CHECK (fits_budget IN ('yes', 'no', 'tight')),
    source_url TEXT,
    source_label TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_search_listings_user_run_date
    ON home_search_listings(user_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_home_search_listings_user_score
    ON home_search_listings(user_id, buy_signal_score DESC);

-- One row per address per run (re-running ingestion the same day replaces, not duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS uq_home_search_listings_user_run_address
    ON home_search_listings(user_id, run_date, address);

-- Lightweight run log, mirrors newsfeed_ingestion_runs — lets the page show
-- "last updated" / whether today's sweep has happened yet, even on a day with
-- zero qualifying listings.
CREATE TABLE IF NOT EXISTS home_search_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_date DATE NOT NULL,
    ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    listings_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,

    UNIQUE(user_id, run_date)
);

ALTER TABLE home_search_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_search_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own home search listings"
    ON home_search_listings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own home search runs"
    ON home_search_runs FOR SELECT
    USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: writes only happen via the service-role
-- client in /api/home-search/ingest (authorized by CRON_SECRET), which bypasses RLS.
