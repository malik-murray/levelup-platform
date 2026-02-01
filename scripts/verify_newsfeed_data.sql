-- Quick verification script to check newsfeed data
-- Run this in Supabase SQL Editor to verify data exists

-- Check sources
SELECT 
    COUNT(*) as total_sources,
    COUNT(*) FILTER (WHERE is_active = true) as active_sources
FROM newsfeed_sources;

-- List all active sources
SELECT id, name, display_name, url, is_active 
FROM newsfeed_sources 
WHERE is_active = true 
ORDER BY display_name;

-- Check topics
SELECT 
    COUNT(*) as total_topics,
    COUNT(*) FILTER (WHERE is_active = true) as active_topics
FROM newsfeed_topics;

-- List all active topics
SELECT id, name, display_name, description, is_active 
FROM newsfeed_topics 
WHERE is_active = true 
ORDER BY display_name;

-- Check RLS policies (if any)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('newsfeed_sources', 'newsfeed_topics');
