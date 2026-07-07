-- Migration: Sports Betting Bot picks
-- Stores daily ranked bet recommendations produced by the external
-- sports-betting-bot project (see src/app/api/sports-betting/ingest/route.ts),
-- so the Sports Betting page can read them the same way Home Search reads
-- its cron-generated data.

CREATE TABLE IF NOT EXISTS sports_betting_bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    logged_at TIMESTAMPTZ NOT NULL,
    match_date DATE NOT NULL,
    competition TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    market TEXT NOT NULL CHECK (market IN ('h2h', 'totals_2.5', 'btts')),
    selection TEXT NOT NULL,

    model_prob NUMERIC(6, 4) NOT NULL,

    primary_book TEXT NOT NULL,
    primary_price NUMERIC(8, 2),
    primary_edge NUMERIC(8, 4),

    best_book TEXT,
    best_price NUMERIC(8, 2),
    best_edge NUMERIC(8, 4),

    confidence TEXT NOT NULL,
    result TEXT CHECK (result IN ('win', 'loss')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_betting_bets_user_match_date
    ON sports_betting_bets(user_id, match_date DESC);

-- One row per specific bet recommendation; re-pushing the same fixture/market/
-- selection (fresher odds same day, or a graded result later) updates in place.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_betting_bets_natural_key
    ON sports_betting_bets(user_id, match_date, home_team, away_team, market, selection);

-- Lightweight run log, mirrors home_search_runs -- lets the page show "last
-- updated" even on a day with zero qualifying bets.
CREATE TABLE IF NOT EXISTS sports_betting_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_date DATE NOT NULL,
    ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bets_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,

    UNIQUE(user_id, run_date)
);

ALTER TABLE sports_betting_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_betting_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sports betting bets"
    ON sports_betting_bets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sports betting runs"
    ON sports_betting_runs FOR SELECT
    USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: writes only happen via the service-role
-- client in /api/sports-betting/ingest (authorized by CRON_SECRET), which
-- bypasses RLS.
