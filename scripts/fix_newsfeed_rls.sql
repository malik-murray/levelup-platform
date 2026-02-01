-- Script to check and fix RLS policies for newsfeed tables
-- Run this in Supabase SQL Editor

-- Check if RLS is enabled
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('newsfeed_sources', 'newsfeed_topics');

-- Disable RLS if it's blocking access (these are public reference tables)
ALTER TABLE newsfeed_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE newsfeed_topics DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, create policies that allow SELECT for authenticated users
-- Uncomment these if you want to use RLS:

-- DROP POLICY IF EXISTS "Allow authenticated users to read sources" ON newsfeed_sources;
-- CREATE POLICY "Allow authenticated users to read sources"
--     ON newsfeed_sources
--     FOR SELECT
--     TO authenticated
--     USING (true);

-- DROP POLICY IF EXISTS "Allow authenticated users to read topics" ON newsfeed_topics;
-- CREATE POLICY "Allow authenticated users to read topics"
--     ON newsfeed_topics
--     FOR SELECT
--     TO authenticated
--     USING (true);
