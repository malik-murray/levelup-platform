-- Migration: Update newsfeed sources to popular open source/free access news sites
-- This replaces the existing sources with popular news sites that have open/free access

-- Clear existing sources (optional - comment out if you want to keep existing)
-- DELETE FROM newsfeed_sources;

-- Insert popular open source/free access news sources
INSERT INTO newsfeed_sources (name, display_name, url) VALUES
    -- Tech & Innovation
    ('hacker_news', 'Hacker News', 'https://news.ycombinator.com'),
    ('techcrunch', 'TechCrunch', 'https://techcrunch.com'),
    ('the_verge', 'The Verge', 'https://www.theverge.com'),
    ('ars_technica', 'Ars Technica', 'https://arstechnica.com'),
    ('wired', 'Wired', 'https://www.wired.com'),
    ('mit_tech_review', 'MIT Technology Review', 'https://www.technologyreview.com'),
    
    -- General News (Open/Free Access)
    ('reuters', 'Reuters', 'https://www.reuters.com'),
    ('bbc', 'BBC News', 'https://www.bbc.com/news'),
    ('the_guardian', 'The Guardian', 'https://www.theguardian.com'),
    ('npr', 'NPR', 'https://www.npr.org'),
    ('ap_news', 'Associated Press', 'https://apnews.com'),
    ('pbs', 'PBS News', 'https://www.pbs.org/newshour'),
    
    -- Business & Finance
    ('bloomberg', 'Bloomberg', 'https://www.bloomberg.com'),
    ('financial_times', 'Financial Times', 'https://www.ft.com'),
    ('economist', 'The Economist', 'https://www.economist.com'),
    
    -- Science & Health
    ('scientific_american', 'Scientific American', 'https://www.scientificamerican.com'),
    ('nature', 'Nature', 'https://www.nature.com'),
    ('science', 'Science Magazine', 'https://www.science.org'),
    
    -- World & Politics
    ('al_jazeera', 'Al Jazeera', 'https://www.aljazeera.com'),
    ('dw', 'Deutsche Welle', 'https://www.dw.com'),
    ('france24', 'France 24', 'https://www.france24.com')
ON CONFLICT (name) DO UPDATE 
    SET display_name = EXCLUDED.display_name,
        url = EXCLUDED.url,
        updated_at = NOW();
