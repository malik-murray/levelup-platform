-- Migration: Newsfeed intelligence layer schema
-- Adds source registry metadata and analysis/ranking persistence tables.

ALTER TABLE newsfeed_sources
ADD COLUMN IF NOT EXISTS domain TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS rss_url TEXT,
ADD COLUMN IF NOT EXISTS reliability_score DOUBLE PRECISION NOT NULL DEFAULT 0.75,
ADD COLUMN IF NOT EXISTS priority_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- Keep rss_url and legacy rss_feed_url aligned.
UPDATE newsfeed_sources
SET rss_url = COALESCE(rss_url, rss_feed_url)
WHERE rss_url IS NULL;

UPDATE newsfeed_sources
SET rss_feed_url = COALESCE(rss_feed_url, rss_url)
WHERE rss_feed_url IS NULL;

CREATE TABLE IF NOT EXISTS newsfeed_article_analysis (
    article_id UUID PRIMARY KEY REFERENCES newsfeed_articles(id) ON DELETE CASCADE,
    source_id UUID REFERENCES newsfeed_sources(id) ON DELETE SET NULL,
    topic TEXT,
    category TEXT,
    importance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    urgency_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    personal_relevance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    location_relevance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    need_to_know_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    noise_penalty DOUBLE PRECISION NOT NULL DEFAULT 0,
    final_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    why_it_matters TEXT,
    user_action TEXT,
    cluster_key TEXT,
    is_whitelisted BOOLEAN NOT NULL DEFAULT false,
    is_duplicate BOOLEAN NOT NULL DEFAULT false,
    model_name TEXT,
    model_confidence DOUBLE PRECISION,
    analysis_json JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_article_analysis_source_id
    ON newsfeed_article_analysis(source_id);
CREATE INDEX IF NOT EXISTS idx_newsfeed_article_analysis_final_score
    ON newsfeed_article_analysis(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_newsfeed_article_analysis_cluster_key
    ON newsfeed_article_analysis(cluster_key);

CREATE TABLE IF NOT EXISTS newsfeed_top_story_rankings (
    article_id UUID PRIMARY KEY REFERENCES newsfeed_articles(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL,
    final_score DOUBLE PRECISION NOT NULL,
    source_id UUID REFERENCES newsfeed_sources(id) ON DELETE SET NULL,
    cluster_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_top_story_rankings_position
    ON newsfeed_top_story_rankings(rank_position);
