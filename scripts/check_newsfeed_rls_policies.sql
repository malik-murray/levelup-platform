-- Check RLS policies for newsfeed_user_preferences table
-- Run this in Supabase SQL Editor to diagnose permission issues

-- Check if RLS is enabled
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'newsfeed_user_preferences';

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'newsfeed_user_preferences';

-- If RLS is blocking, create policies to allow authenticated users to manage their preferences
-- Uncomment and run these if needed:

-- DROP POLICY IF EXISTS "Users can read their own preferences" ON newsfeed_user_preferences;
-- CREATE POLICY "Users can read their own preferences"
--     ON newsfeed_user_preferences
--     FOR SELECT
--     TO authenticated
--     USING (auth.uid() = user_id);

-- DROP POLICY IF EXISTS "Users can insert their own preferences" ON newsfeed_user_preferences;
-- CREATE POLICY "Users can insert their own preferences"
--     ON newsfeed_user_preferences
--     FOR INSERT
--     TO authenticated
--     WITH CHECK (auth.uid() = user_id);

-- DROP POLICY IF EXISTS "Users can update their own preferences" ON newsfeed_user_preferences;
-- CREATE POLICY "Users can update their own preferences"
--     ON newsfeed_user_preferences
--     FOR UPDATE
--     TO authenticated
--     USING (auth.uid() = user_id)
--     WITH CHECK (auth.uid() = user_id);
