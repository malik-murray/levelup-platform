-- Migration: Add DMV and federal-workforce focus to newsfeed taxonomy and sources

-- Add focused topics used by personalization presets and matcher.
INSERT INTO newsfeed_topics (name, display_name, description, is_active)
VALUES
    ('dmv', 'DMV Region', 'Washington DC, Maryland, and Virginia regional news', true),
    ('federal_workforce', 'Federal Workforce', 'News affecting federal employees and civil service', true)
ON CONFLICT (name) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Add DMV/local and federal workforce relevant sources.
INSERT INTO newsfeed_sources (name, display_name, url, rss_feed_url, is_active)
VALUES
    ('wtop', 'WTOP', 'https://wtop.com', 'https://wtop.com/feed/', true),
    ('dcist', 'DCist', 'https://dcist.com', 'https://dcist.com/feed/', true),
    ('federal_news_network', 'Federal News Network', 'https://federalnewsnetwork.com', 'https://federalnewsnetwork.com/feed/', true)
ON CONFLICT (name) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    url = EXCLUDED.url,
    rss_feed_url = EXCLUDED.rss_feed_url,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
