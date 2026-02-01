-- Migration: Upgrade newsfeed_articles schema for RSS ingestion
-- Adds RSS feed URLs, unique URL constraint, image, and raw JSON storage

-- ============================================================
-- 1. ADD RSS FEED URL COLUMN TO SOURCES
-- ============================================================
ALTER TABLE newsfeed_sources 
ADD COLUMN IF NOT EXISTS rss_feed_url TEXT;

-- ============================================================
-- 2. UPGRADE ARTICLES TABLE
-- ============================================================
-- Add description column for RSS feed description/summary
ALTER TABLE newsfeed_articles 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add image URL column
ALTER TABLE newsfeed_articles 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add raw JSON column for storing full article data
ALTER TABLE newsfeed_articles 
ADD COLUMN IF NOT EXISTS raw_json JSONB;

-- Add unique constraint on URL to prevent duplicates
-- First, remove any existing duplicates (keep the oldest one)
DO $$
BEGIN
    DELETE FROM newsfeed_articles a
    USING newsfeed_articles b
    WHERE a.id > b.id
    AND a.url = b.url;
END $$;

-- Create unique index on URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsfeed_articles_url_unique 
ON newsfeed_articles(url);

-- ============================================================
-- 3. ADD RSS FEED URLS TO EXISTING SOURCES
-- ============================================================
UPDATE newsfeed_sources 
SET rss_feed_url = CASE name
    -- Tech & Innovation
    WHEN 'hacker_news' THEN 'https://hnrss.org/frontpage'
    WHEN 'techcrunch' THEN 'https://techcrunch.com/feed/'
    WHEN 'the_verge' THEN 'https://www.theverge.com/rss/index.xml'
    WHEN 'ars_technica' THEN 'https://feeds.arstechnica.com/arstechnica/index'
    WHEN 'wired' THEN 'https://www.wired.com/feed/rss'
    WHEN 'mit_tech_review' THEN 'https://www.technologyreview.com/feed/'
    WHEN 'engadget' THEN 'https://www.engadget.com/rss.xml'
    WHEN 'gizmodo' THEN 'https://gizmodo.com/rss'
    
    -- General News
    WHEN 'reuters' THEN 'https://www.reuters.com/rssFeed/worldNews'
    WHEN 'bbc' THEN 'https://feeds.bbci.co.uk/news/rss.xml'
    WHEN 'the_guardian' THEN 'https://www.theguardian.com/world/rss'
    WHEN 'npr' THEN 'https://feeds.npr.org/1001/rss.xml'
    WHEN 'ap_news' THEN 'https://apnews.com/apf-topnews'
    WHEN 'pbs' THEN 'https://www.pbs.org/newshour/feed/rss'
    WHEN 'cnn' THEN 'http://rss.cnn.com/rss/edition.rss'
    WHEN 'abc' THEN 'https://abcnews.go.com/abcnews/topstories'
    
    -- Business & Finance
    WHEN 'bloomberg' THEN 'https://feeds.bloomberg.com/markets/news.rss'
    WHEN 'financial_times' THEN 'https://www.ft.com/?format=rss'
    WHEN 'economist' THEN 'https://www.economist.com/finance-and-economics/rss.xml'
    WHEN 'wsj' THEN 'https://feeds.a.dj.com/rss/RSSWorldNews.xml'
    WHEN 'marketwatch' THEN 'https://www.marketwatch.com/rss/topstories'
    
    -- Science & Health
    WHEN 'scientific_american' THEN 'https://rss.sciam.com/ScientificAmerican-Global'
    WHEN 'nature' THEN 'https://www.nature.com/nature.rss'
    WHEN 'science' THEN 'https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science'
    WHEN 'national_geographic' THEN 'https://feeds.nationalgeographic.com/ng/News/News_Main'
    
    -- World & Politics
    WHEN 'al_jazeera' THEN 'https://www.aljazeera.com/xml/rss/all.xml'
    WHEN 'dw' THEN 'https://rss.dw.com/xml/rss-en-all'
    WHEN 'france24' THEN 'https://www.france24.com/en/rss'
    WHEN 'nytimes' THEN 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
    ELSE NULL
END
WHERE rss_feed_url IS NULL;

-- ============================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on articles table
ALTER TABLE newsfeed_articles ENABLE ROW LEVEL SECURITY;

-- Articles: Anyone authenticated can read (for feed)
CREATE POLICY "Users can read articles"
ON newsfeed_articles
FOR SELECT
TO authenticated
USING (true);

-- Articles: Service role bypasses RLS when using service_role key
-- No policy needed - service role key bypasses RLS automatically

-- User article actions: Users can read their own actions
ALTER TABLE newsfeed_user_article_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own article actions"
ON newsfeed_user_article_actions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- User article actions: Users can insert/update their own actions
CREATE POLICY "Users can manage own article actions"
ON newsfeed_user_article_actions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_newsfeed_articles_url ON newsfeed_articles(url);
CREATE INDEX IF NOT EXISTS idx_newsfeed_articles_publish_time_desc ON newsfeed_articles(publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_newsfeed_sources_rss_feed_url ON newsfeed_sources(rss_feed_url) WHERE rss_feed_url IS NOT NULL;
