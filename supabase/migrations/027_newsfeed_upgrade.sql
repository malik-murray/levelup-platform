-- Migration: Newsfeed Generator Upgrade
-- This migration creates tables for the upgraded newsfeed feature with preferences, sources, topics, and article management

-- ============================================================
-- 1. NEWS SOURCES (Master list of available news sources)
-- ============================================================
CREATE TABLE IF NOT EXISTS newsfeed_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., "CNN", "ABC", "Reuters"
    display_name TEXT NOT NULL, -- e.g., "CNN News"
    url TEXT, -- Homepage URL
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_sources_active ON newsfeed_sources(is_active);

-- ============================================================
-- 2. NEWS TOPICS (Master list of topics)
-- ============================================================
CREATE TABLE IF NOT EXISTS newsfeed_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- e.g., "Crypto", "AI", "Tech"
    display_name TEXT NOT NULL, -- e.g., "Cryptocurrency"
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_topics_active ON newsfeed_topics(is_active);

-- ============================================================
-- 3. USER PREFERENCES (Selected sources and topics)
-- ============================================================
CREATE TABLE IF NOT EXISTS newsfeed_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    selected_source_ids JSONB DEFAULT '[]'::jsonb, -- Array of source IDs
    selected_topic_ids JSONB DEFAULT '[]'::jsonb, -- Array of topic IDs
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_user_preferences_user_id ON newsfeed_user_preferences(user_id);

-- ============================================================
-- 4. USER CONTEXT ("About Me" for personal relevance)
-- ============================================================
CREATE TABLE IF NOT EXISTS newsfeed_user_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_job_context TEXT, -- e.g., "fed gov", "tech", "business"
    interests JSONB DEFAULT '[]'::jsonb, -- Array of interests: ["crypto", "AI", "parenting"]
    goals JSONB DEFAULT '[]'::jsonb, -- Array of goals: ["career growth", "financial growth", "family"]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_user_context_user_id ON newsfeed_user_context(user_id);

-- ============================================================
-- 5. ARTICLES (Articles from sources)
-- ============================================================
CREATE TABLE IF NOT EXISTS newsfeed_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES newsfeed_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    publish_time TIMESTAMPTZ NOT NULL,
    topic_ids JSONB DEFAULT '[]'::jsonb, -- Array of topic IDs this article matches
    raw_content TEXT, -- Original article content (optional, for now)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_articles_source_id ON newsfeed_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_newsfeed_articles_publish_time ON newsfeed_articles(publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_newsfeed_articles_topic_ids ON newsfeed_articles USING GIN(topic_ids);

-- ============================================================
-- 6. ARTICLE SUMMARIES (Generated summaries with different lengths)
-- ============================================================
CREATE TABLE IF NOT EXISTS newsfeed_article_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES newsfeed_articles(id) ON DELETE CASCADE,
    summary_1_paragraph TEXT, -- 1 paragraph summary
    summary_2_paragraphs TEXT, -- 2 paragraph summary
    summary_3_paragraphs TEXT, -- 3 paragraph summary
    summary_4_paragraphs TEXT, -- 4 paragraph summary
    summary_5_paragraphs TEXT, -- 5 paragraph summary
    why_it_matters TEXT, -- Personal relevance explanation (generated using user context)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(article_id)
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_article_summaries_article_id ON newsfeed_article_summaries(article_id);

-- ============================================================
-- 7. USER ARTICLE ACTIONS (Save, Archive, Summary Length Preference)
-- ============================================================
CREATE TABLE IF NOT EXISTS newsfeed_user_article_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES newsfeed_articles(id) ON DELETE CASCADE,
    is_saved BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    preferred_summary_length INTEGER CHECK (preferred_summary_length >= 1 AND preferred_summary_length <= 5) DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_user_article_actions_user_id ON newsfeed_user_article_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_newsfeed_user_article_actions_article_id ON newsfeed_user_article_actions(article_id);
CREATE INDEX IF NOT EXISTS idx_newsfeed_user_article_actions_saved ON newsfeed_user_article_actions(user_id, is_saved) WHERE is_saved = true;
CREATE INDEX IF NOT EXISTS idx_newsfeed_user_article_actions_archived ON newsfeed_user_article_actions(user_id, is_archived) WHERE is_archived = true;

-- ============================================================
-- 8. SEED DEFAULT SOURCES
-- ============================================================
INSERT INTO newsfeed_sources (name, display_name, url) VALUES
    ('cnn', 'CNN', 'https://www.cnn.com'),
    ('abc', 'ABC News', 'https://abcnews.go.com'),
    ('reuters', 'Reuters', 'https://www.reuters.com'),
    ('bbc', 'BBC News', 'https://www.bbc.com/news'),
    ('techcrunch', 'TechCrunch', 'https://techcrunch.com'),
    ('the_verge', 'The Verge', 'https://www.theverge.com'),
    ('wsj', 'Wall Street Journal', 'https://www.wsj.com'),
    ('nytimes', 'The New York Times', 'https://www.nytimes.com')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 9. SEED DEFAULT TOPICS
-- ============================================================
INSERT INTO newsfeed_topics (name, display_name, description) VALUES
    ('crypto', 'Crypto', 'Cryptocurrency and blockchain news'),
    ('ai', 'AI', 'Artificial intelligence and machine learning'),
    ('tech', 'Tech', 'Technology and innovation'),
    ('fed_gov', 'Fed Gov', 'Federal government and policy'),
    ('parenting', 'Parenting', 'Parenting and family'),
    ('relationships', 'Relationships', 'Relationships and social'),
    ('business', 'Business', 'Business and entrepreneurship'),
    ('world', 'World', 'World news and international affairs'),
    ('economy', 'Economy', 'Economic news and markets')
ON CONFLICT (name) DO NOTHING;





