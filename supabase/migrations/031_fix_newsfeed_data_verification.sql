-- Migration: Verify and fix newsfeed sources and topics data
-- This migration ensures data exists and is properly set up

-- First, let's make sure all existing records are active
UPDATE newsfeed_sources SET is_active = true WHERE is_active IS NULL OR is_active = false;
UPDATE newsfeed_topics SET is_active = true WHERE is_active IS NULL OR is_active = false;

-- Insert sources if they don't exist (using the same data from migration 030)
INSERT INTO newsfeed_sources (name, display_name, url, is_active) VALUES
    -- Tech & Innovation
    ('hacker_news', 'Hacker News', 'https://news.ycombinator.com', true),
    ('techcrunch', 'TechCrunch', 'https://techcrunch.com', true),
    ('the_verge', 'The Verge', 'https://www.theverge.com', true),
    ('ars_technica', 'Ars Technica', 'https://arstechnica.com', true),
    ('wired', 'Wired', 'https://www.wired.com', true),
    ('mit_tech_review', 'MIT Technology Review', 'https://www.technologyreview.com', true),
    ('engadget', 'Engadget', 'https://www.engadget.com', true),
    ('gizmodo', 'Gizmodo', 'https://gizmodo.com', true),
    
    -- General News (Open/Free Access)
    ('reuters', 'Reuters', 'https://www.reuters.com', true),
    ('bbc', 'BBC News', 'https://www.bbc.com/news', true),
    ('the_guardian', 'The Guardian', 'https://www.theguardian.com', true),
    ('npr', 'NPR', 'https://www.npr.org', true),
    ('ap_news', 'Associated Press', 'https://apnews.com', true),
    ('pbs', 'PBS News', 'https://www.pbs.org/newshour', true),
    ('cnn', 'CNN', 'https://www.cnn.com', true),
    ('abc', 'ABC News', 'https://abcnews.go.com', true),
    
    -- Business & Finance
    ('bloomberg', 'Bloomberg', 'https://www.bloomberg.com', true),
    ('financial_times', 'Financial Times', 'https://www.ft.com', true),
    ('economist', 'The Economist', 'https://www.economist.com', true),
    ('wsj', 'Wall Street Journal', 'https://www.wsj.com', true),
    ('marketwatch', 'MarketWatch', 'https://www.marketwatch.com', true),
    
    -- Science & Health
    ('scientific_american', 'Scientific American', 'https://www.scientificamerican.com', true),
    ('nature', 'Nature', 'https://www.nature.com', true),
    ('science', 'Science Magazine', 'https://www.science.org', true),
    ('national_geographic', 'National Geographic', 'https://www.nationalgeographic.com', true),
    
    -- World & Politics
    ('al_jazeera', 'Al Jazeera', 'https://www.aljazeera.com', true),
    ('dw', 'Deutsche Welle', 'https://www.dw.com', true),
    ('france24', 'France 24', 'https://www.france24.com', true),
    ('nytimes', 'The New York Times', 'https://www.nytimes.com', true)
ON CONFLICT (name) DO UPDATE 
    SET display_name = EXCLUDED.display_name,
        url = EXCLUDED.url,
        is_active = true,
        updated_at = NOW();

-- Insert topics if they don't exist
INSERT INTO newsfeed_topics (name, display_name, description, is_active) VALUES
    -- Technology
    ('tech', 'Technology', 'Technology and innovation news', true),
    ('ai', 'Artificial Intelligence', 'AI and machine learning developments', true),
    ('crypto', 'Cryptocurrency', 'Cryptocurrency and blockchain news', true),
    ('software', 'Software', 'Software development and programming', true),
    ('hardware', 'Hardware', 'Hardware and devices', true),
    ('startups', 'Startups', 'Startup news and entrepreneurship', true),
    
    -- Business & Finance
    ('business', 'Business', 'Business and corporate news', true),
    ('economy', 'Economy', 'Economic news and markets', true),
    ('finance', 'Finance', 'Financial markets and investing', true),
    ('stocks', 'Stocks', 'Stock market news', true),
    ('crypto_markets', 'Crypto Markets', 'Cryptocurrency market news', true),
    
    -- Science & Health
    ('science', 'Science', 'Scientific discoveries and research', true),
    ('health', 'Health', 'Health and medical news', true),
    ('medicine', 'Medicine', 'Medical breakthroughs and research', true),
    ('climate', 'Climate', 'Climate change and environment', true),
    ('space', 'Space', 'Space exploration and astronomy', true),
    
    -- World & Politics
    ('world', 'World News', 'International news and affairs', true),
    ('politics', 'Politics', 'Political news and analysis', true),
    ('fed_gov', 'Federal Government', 'US federal government and policy', true),
    ('elections', 'Elections', 'Election news and politics', true),
    ('international', 'International', 'International relations', true),
    
    -- Society & Culture
    ('culture', 'Culture', 'Cultural news and trends', true),
    ('sports', 'Sports', 'Sports news and updates', true),
    ('entertainment', 'Entertainment', 'Entertainment industry news', true),
    ('lifestyle', 'Lifestyle', 'Lifestyle and wellness', true),
    ('parenting', 'Parenting', 'Parenting and family news', true),
    ('relationships', 'Relationships', 'Relationships and social news', true),
    ('education', 'Education', 'Education news and policy', true),
    
    -- Specialized
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

-- Verify the data
DO $$
DECLARE
    source_count INTEGER;
    topic_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO source_count FROM newsfeed_sources WHERE is_active = true;
    SELECT COUNT(*) INTO topic_count FROM newsfeed_topics WHERE is_active = true;
    
    RAISE NOTICE 'Active sources: %', source_count;
    RAISE NOTICE 'Active topics: %', topic_count;
END $$;
