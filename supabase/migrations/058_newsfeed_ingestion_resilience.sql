-- Migration: ingestion resilience and fallback topics

ALTER TABLE newsfeed_sources
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

INSERT INTO newsfeed_topics (name, display_name, description, is_active)
VALUES
    ('general_business', 'General Business', 'Fallback topic for uncategorized business/economy content', true),
    ('general_politics', 'General Politics', 'Fallback topic for uncategorized politics/government content', true),
    ('general_federal_government', 'General Federal Government', 'Fallback topic for uncategorized federal news', true),
    ('general_local', 'General Local', 'Fallback topic for uncategorized local/DMV content', true),
    ('general_tech', 'General Tech', 'Fallback topic for uncategorized technology content', true),
    ('general_health', 'General Health', 'Fallback topic for uncategorized health/science content', true),
    ('general_sports', 'General Sports', 'Fallback topic for uncategorized sports content', true),
    ('general_news', 'General News', 'Fallback topic for uncategorized general news content', true)
ON CONFLICT (name) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
