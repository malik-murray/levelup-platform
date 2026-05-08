-- Migration: source feed health + ingestion run tracking

ALTER TABLE newsfeed_sources
ADD COLUMN IF NOT EXISTS feed_status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_error_code TEXT,
ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS newsfeed_ingestion_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    sources_processed INTEGER NOT NULL DEFAULT 0,
    total_fetched INTEGER NOT NULL DEFAULT 0,
    total_inserted INTEGER NOT NULL DEFAULT 0,
    exact_topic_assignments INTEGER NOT NULL DEFAULT 0,
    fallback_topic_assignments INTEGER NOT NULL DEFAULT 0,
    failed_batches INTEGER NOT NULL DEFAULT 0,
    inactive_feeds INTEGER NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_ingestion_runs_started_at
    ON newsfeed_ingestion_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsfeed_ingestion_runs_status
    ON newsfeed_ingestion_runs(status);
