-- Complete fix script for newsfeed sources and topics
-- Run this entire script in Supabase SQL Editor

-- Step 1: Disable RLS on reference tables (these should be publicly readable)
ALTER TABLE IF EXISTS newsfeed_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS newsfeed_topics DISABLE ROW LEVEL SECURITY;

-- Step 2: Ensure all existing records are active
UPDATE newsfeed_sources SET is_active = true WHERE is_active IS NULL OR is_active = false;
UPDATE newsfeed_topics SET is_active = true WHERE is_active IS NULL OR is_active = false;

-- Step 3: Insert/Update sources
INSERT INTO newsfeed_sources (name, display_name, url, is_active) VALUES
    ('hacker_news', 'Hacker News', 'https://news.ycombinator.com', true),
    ('techcrunch', 'TechCrunch', 'https://techcrunch.com', true),
    ('the_verge', 'The Verge', 'https://www.theverge.com', true),
    ('ars_technica', 'Ars Technica', 'https://arstechnica.com', true),
    ('wired', 'Wired', 'https://www.wired.com', true),
    ('mit_tech_review', 'MIT Technology Review', 'https://www.technologyreview.com', true),
    ('engadget', 'Engadget', 'https://www.engadget.com', true),
    ('gizmodo', 'Gizmodo', 'https://gizmodo.com', true),
    ('reuters', 'Reuters', 'https://www.reuters.com', true),
    ('bbc', 'BBC News', 'https://www.bbc.com/news', true),
    ('the_guardian', 'The Guardian', 'https://www.theguardian.com', true),
    ('npr', 'NPR', 'https://www.npr.org', true),
    ('ap_news', 'Associated Press', 'https://apnews.com', true),
    ('pbs', 'PBS News', 'https://www.pbs.org/newshour', true),
    ('cnn', 'CNN', 'https://www.cnn.com', true),
    ('abc', 'ABC News', 'https://abcnews.go.com', true),
    ('bloomberg', 'Bloomberg', 'https://www.bloomberg.com', true),
    ('financial_times', 'Financial Times', 'https://www.ft.com', true),
    ('economist', 'The Economist', 'https://www.economist.com', true),
    ('wsj', 'Wall Street Journal', 'https://www.wsj.com', true),
    ('marketwatch', 'MarketWatch', 'https://www.marketwatch.com', true),
    ('scientific_american', 'Scientific American', 'https://www.scientificamerican.com', true),
    ('nature', 'Nature', 'https://www.nature.com', true),
    ('science', 'Science Magazine', 'https://www.science.org', true),
    ('national_geographic', 'National Geographic', 'https://www.nationalgeographic.com', true),
    ('al_jazeera', 'Al Jazeera', 'https://www.aljazeera.com', true),
    ('dw', 'Deutsche Welle', 'https://www.dw.com', true),
    ('france24', 'France 24', 'https://www.france24.com', true),
    ('nytimes', 'The New York Times', 'https://www.nytimes.com', true)
ON CONFLICT (name) DO UPDATE 
    SET display_name = EXCLUDED.display_name,
        url = EXCLUDED.url,
        is_active = true,
        updated_at = NOW();

-- Step 4: Insert/Update topics
INSERT INTO newsfeed_topics (name, display_name, description, is_active) VALUES
    ('tech', 'Technology', 'Technology and innovation news', true),
    ('ai', 'Artificial Intelligence', 'AI and machine learning developments', true),
    ('crypto', 'Cryptocurrency', 'Cryptocurrency and blockchain news', true),
    ('software', 'Software', 'Software development and programming', true),
    ('hardware', 'Hardware', 'Hardware and devices', true),
    ('startups', 'Startups', 'Startup news and entrepreneurship', true),
    ('business', 'Business', 'Business and corporate news', true),
    ('economy', 'Economy', 'Economic news and markets', true),
    ('finance', 'Finance', 'Financial markets and investing', true),
    ('stocks', 'Stocks', 'Stock market news', true),
    ('crypto_markets', 'Crypto Markets', 'Cryptocurrency market news', true),
    ('science', 'Science', 'Scientific discoveries and research', true),
    ('health', 'Health', 'Health and medical news', true),
    ('medicine', 'Medicine', 'Medical breakthroughs and research', true),
    ('climate', 'Climate', 'Climate change and environment', true),
    ('space', 'Space', 'Space exploration and astronomy', true),
    ('world', 'World News', 'International news and affairs', true),
    ('politics', 'Politics', 'Political news and analysis', true),
    ('fed_gov', 'Federal Government', 'US federal government and policy', true),
    ('elections', 'Elections', 'Election news and politics', true),
    ('international', 'International', 'International relations', true),
    ('culture', 'Culture', 'Cultural news and trends', true),
    ('sports', 'Sports', 'Sports news and updates', true),
    ('entertainment', 'Entertainment', 'Entertainment industry news', true),
    ('lifestyle', 'Lifestyle', 'Lifestyle and wellness', true),
    ('parenting', 'Parenting', 'Parenting and family news', true),
    ('relationships', 'Relationships', 'Relationships and social news', true),
    ('education', 'Education', 'Education news and policy', true),
    ('security', 'Security', 'Cybersecurity and privacy', true),
    ('privacy', 'Privacy', 'Privacy and data protection', true),
    ('energy', 'Energy', 'Energy news and policy', true),
    ('transportation', 'Transportation', 'Transportation and mobility', true),
    ('real_estate', 'Real Estate', 'Real estate market news', true)
ON CONFLICT (name) DO UPDATE 
    SET display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        is_active = true,
        updated_at = NOW();

-- Step 5: Set up RLS policies for preferences table
-- Disable RLS on reference tables (they should be publicly readable)
ALTER TABLE IF EXISTS newsfeed_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS newsfeed_topics DISABLE ROW LEVEL SECURITY;

-- Enable RLS on user preferences (users should only access their own preferences)
ALTER TABLE IF EXISTS newsfeed_user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own preferences" ON newsfeed_user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON newsfeed_user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON newsfeed_user_preferences;

-- Create policies for authenticated users to manage their own preferences
CREATE POLICY "Users can read their own preferences"
    ON newsfeed_user_preferences
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
    ON newsfeed_user_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
    ON newsfeed_user_preferences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Step 6: Verify the data
SELECT 
    'Sources' as table_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_active = true) as active
FROM newsfeed_sources
UNION ALL
SELECT 
    'Topics' as table_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_active = true) as active
FROM newsfeed_topics;
