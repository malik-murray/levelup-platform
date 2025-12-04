-- Migration: Populate habit tracker with sample data for November
-- This migration creates sample habits, goals, milestones, and daily entries
-- Note: Replace 'USER_ID_HERE' with an actual user_id from auth.users

-- First, let's create a function to get a user_id (using the first user as example)
-- In production, you'd want to specify the actual user_id

DO $$
DECLARE
    sample_user_id UUID;
    goal_id_1 UUID;
    goal_id_2 UUID;
    goal_id_3 UUID;
    sub_goal_id_1 UUID;
    sub_goal_id_2 UUID;
    habit_id_1 UUID;
    habit_id_2 UUID;
    habit_id_3 UUID;
    habit_id_4 UUID;
    habit_id_5 UUID;
    habit_id_6 UUID;
    bad_habit_id_1 UUID;
    bad_habit_id_2 UUID;
    milestone_id_1 UUID;
    entry_date DATE;
    date_str TEXT;
BEGIN
    -- Ensure columns exist (in case migration 007 wasn't run with them)
    ALTER TABLE habit_goals
    ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('financial', 'physical', 'spiritual', 'business', 'personal', 'mental', 'health', 'career', 'relationships', 'education', 'other'));
    
    ALTER TABLE habit_templates
    ADD COLUMN IF NOT EXISTS is_bad_habit BOOLEAN DEFAULT false;
    
    -- Clean up existing sample data for November 2024 (optional - comment out if you want to keep existing data)
    -- DELETE FROM habit_daily_scores WHERE user_id IN (SELECT id FROM auth.users LIMIT 1) AND date >= '2024-11-01' AND date <= '2024-11-30';
    -- DELETE FROM habit_daily_content WHERE user_id IN (SELECT id FROM auth.users LIMIT 1) AND date >= '2024-11-01' AND date <= '2024-11-30';
    -- DELETE FROM habit_daily_todos WHERE user_id IN (SELECT id FROM auth.users LIMIT 1) AND date >= '2024-11-01' AND date <= '2024-11-30';
    -- DELETE FROM habit_daily_priorities WHERE user_id IN (SELECT id FROM auth.users LIMIT 1) AND date >= '2024-11-01' AND date <= '2024-11-30';
    -- DELETE FROM habit_daily_entries WHERE user_id IN (SELECT id FROM auth.users LIMIT 1) AND date >= '2024-11-01' AND date <= '2024-11-30';
    
    -- Get the first user (or you can specify a specific user_id)
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    
    -- If no user exists, exit
    IF sample_user_id IS NULL THEN
        RAISE NOTICE 'No users found. Please create a user first.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Using user_id: %', sample_user_id;

    -- ============================================
    -- CREATE GOALS
    -- ============================================
    
    -- Goal 1: Lose Weight (Physical/Health)
    INSERT INTO habit_goals (user_id, name, description, category, target_value, target_unit, current_value)
    VALUES (sample_user_id, 'Lose 20lbs', 'Get to my target weight for better health', 'physical', 20, 'lbs', 5)
    RETURNING id INTO goal_id_1;
    
    -- Sub-goal for Goal 1
    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id, target_value, target_unit, current_value)
    VALUES (sample_user_id, 'Workout 4x per week', 'Consistent exercise routine', 'physical', goal_id_1, 16, 'workouts', 8)
    RETURNING id INTO sub_goal_id_1;
    
    -- Goal 2: Build YouTube Channel (Business)
    INSERT INTO habit_goals (user_id, name, description, category, target_value, target_unit, current_value)
    VALUES (sample_user_id, 'Grow YouTube Channel', 'Build a successful content creation business', 'business', 1000, 'subscribers', 250)
    RETURNING id INTO goal_id_2;
    
    -- Goal 3: Financial Freedom (Financial)
    INSERT INTO habit_goals (user_id, name, description, category, target_value, target_unit, current_value)
    VALUES (sample_user_id, 'Save $10,000 Emergency Fund', 'Build financial security', 'financial', 10000, 'dollars', 3500)
    RETURNING id INTO goal_id_3;
    
    -- Sub-goal for Goal 3
    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id, target_value, target_unit, current_value)
    VALUES (sample_user_id, 'Save $500/month', 'Monthly savings target', 'financial', goal_id_3, 500, 'dollars', 350)
    RETURNING id INTO sub_goal_id_2;

    -- ============================================
    -- CREATE MILESTONES
    -- ============================================
    
    -- Milestone for YouTube Channel
    INSERT INTO habit_milestones (user_id, goal_id, name, values, current_value)
    VALUES (sample_user_id, goal_id_2, 'YouTube Subscribers', '[100, 250, 500, 1000, 2500, 5000, 10000]'::jsonb, 250);
    
    -- Standalone Milestone
    INSERT INTO habit_milestones (user_id, goal_id, name, values, current_value)
    VALUES (sample_user_id, NULL, 'Blog Posts Published', '[5, 10, 25, 50, 100]'::jsonb, 12);

    -- ============================================
    -- CREATE HABIT TEMPLATES (Good Habits)
    -- ============================================
    
    -- Insert habits one by one to get IDs
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Morning Workout', '💪', 'physical', 'morning', goal_id_1, false, true, 1)
    RETURNING id INTO habit_id_1;
    
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Meditation', '🧘', 'spiritual', 'morning', NULL, false, true, 2)
    RETURNING id INTO habit_id_2;
    
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Read 30 mins', '📚', 'mental', 'evening', NULL, false, true, 3)
    RETURNING id INTO habit_id_3;
    
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Journal', '✍️', 'mental', 'evening', NULL, false, true, 4)
    RETURNING id INTO habit_id_4;
    
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Prayer', '🙏', 'spiritual', 'morning', NULL, false, true, 5)
    RETURNING id INTO habit_id_5;
    
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Gratitude List', '🙌', 'spiritual', 'evening', NULL, false, true, 6)
    RETURNING id INTO habit_id_6;

    -- ============================================
    -- CREATE BAD HABITS
    -- ============================================
    
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Smoking', '🚬', 'physical', NULL, NULL, true, true, 1)
    RETURNING id INTO bad_habit_id_1;
    
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES (sample_user_id, 'Late Night Snacking', '🍕', 'physical', 'evening', NULL, true, true, 2)
    RETURNING id INTO bad_habit_id_2;

    -- ============================================
    -- CREATE DAILY ENTRIES FOR NOVEMBER (Current Year)
    -- ============================================
    
    -- Generate entries for November 1-30 of current year
    -- Using November 2024 for sample data (can be changed to current year if needed)
    FOR i IN 1..30 LOOP
        entry_date := DATE '2024-11-01' + (i - 1);
        date_str := TO_CHAR(entry_date, 'YYYY-MM-DD');
        
        -- Random habit statuses (checked, half, missed)
        -- Good habits: more likely to be checked
        INSERT INTO habit_daily_entries (user_id, date, habit_template_id, status)
        VALUES 
            (sample_user_id, entry_date, habit_id_1, 
             CASE WHEN random() > 0.3 THEN 'checked' WHEN random() > 0.5 THEN 'half' ELSE 'missed' END),
            (sample_user_id, entry_date, habit_id_2, 
             CASE WHEN random() > 0.2 THEN 'checked' WHEN random() > 0.5 THEN 'half' ELSE 'missed' END),
            (sample_user_id, entry_date, habit_id_3, 
             CASE WHEN random() > 0.4 THEN 'checked' WHEN random() > 0.5 THEN 'half' ELSE 'missed' END),
            (sample_user_id, entry_date, habit_id_4, 
             CASE WHEN random() > 0.35 THEN 'checked' WHEN random() > 0.5 THEN 'half' ELSE 'missed' END),
            (sample_user_id, entry_date, habit_id_5, 
             CASE WHEN random() > 0.15 THEN 'checked' WHEN random() > 0.5 THEN 'half' ELSE 'missed' END),
            (sample_user_id, entry_date, habit_id_6, 
             CASE WHEN random() > 0.25 THEN 'checked' WHEN random() > 0.5 THEN 'half' ELSE 'missed' END);
        
        -- Bad habits: more likely to be missed (avoided = good)
        INSERT INTO habit_daily_entries (user_id, date, habit_template_id, status)
        VALUES 
            (sample_user_id, entry_date, bad_habit_id_1, 
             CASE WHEN random() > 0.7 THEN 'missed' WHEN random() > 0.5 THEN 'half' ELSE 'checked' END),
            (sample_user_id, entry_date, bad_habit_id_2, 
             CASE WHEN random() > 0.6 THEN 'missed' WHEN random() > 0.5 THEN 'half' ELSE 'checked' END);
        
        -- Sample priorities (3 per day, some completed)
        -- Note: category must be 'physical', 'mental', or 'spiritual'
        INSERT INTO habit_daily_priorities (user_id, date, text, category, time_of_day, completed, sort_order)
        VALUES 
            (sample_user_id, entry_date, 
             CASE (i % 5)
                 WHEN 0 THEN 'Complete project proposal'
                 WHEN 1 THEN 'Call mom'
                 WHEN 2 THEN 'Review budget'
                 WHEN 3 THEN 'Schedule doctor appointment'
                 ELSE 'Finish presentation'
             END,
             CASE WHEN random() > 0.66 THEN 'mental' WHEN random() > 0.33 THEN 'spiritual' ELSE 'physical' END,
             'morning',
             random() > 0.4,
             1),
            (sample_user_id, entry_date,
             CASE (i % 4)
                 WHEN 0 THEN 'Grocery shopping'
                 WHEN 1 THEN 'Update resume'
                 WHEN 2 THEN 'Plan weekend trip'
                 ELSE 'Organize workspace'
             END,
             CASE WHEN random() > 0.66 THEN 'mental' WHEN random() > 0.33 THEN 'spiritual' ELSE 'physical' END,
             'afternoon',
             random() > 0.5,
             2),
            (sample_user_id, entry_date,
             CASE (i % 3)
                 WHEN 0 THEN 'Review finances'
                 WHEN 1 THEN 'Exercise'
                 ELSE 'Read chapter'
             END,
             CASE WHEN random() > 0.66 THEN 'mental' WHEN random() > 0.33 THEN 'spiritual' ELSE 'physical' END,
             'evening',
             random() > 0.6,
             3);
        
        -- Sample todos (3-5 per day)
        FOR j IN 1..(3 + floor(random() * 3)::int) LOOP
            INSERT INTO habit_daily_todos (user_id, date, title, category, time_of_day, is_done)
            VALUES (
                sample_user_id,
                entry_date,
                CASE (j % 7)
                    WHEN 0 THEN 'Email client follow-up'
                    WHEN 1 THEN 'Grocery shopping'
                    WHEN 2 THEN 'Update resume'
                    WHEN 3 THEN 'Clean kitchen'
                    WHEN 4 THEN 'Write blog post'
                    WHEN 5 THEN 'Schedule meeting'
                    ELSE 'Review documents'
                END,
                CASE 
                    WHEN random() > 0.66 THEN 'mental'
                    WHEN random() > 0.33 THEN 'spiritual'
                    ELSE 'physical'
                END,
                CASE 
                    WHEN random() > 0.66 THEN 'morning'
                    WHEN random() > 0.33 THEN 'afternoon'
                    ELSE 'evening'
                END,
                random() > 0.6
            );
        END LOOP;
        
        -- Daily content (some days have content) - using UPSERT
        IF random() > 0.3 THEN
            INSERT INTO habit_daily_content (user_id, date, lessons, ideas, notes, distractions, reflection)
            VALUES (
                sample_user_id,
                entry_date,
                CASE WHEN random() > 0.5 THEN 'Learned about time management today. Setting boundaries is key.' ELSE NULL END,
                CASE WHEN random() > 0.6 THEN 'Idea: Create a morning routine checklist app' ELSE NULL END,
                CASE WHEN random() > 0.4 THEN 'Feeling more energized after consistent workouts' ELSE NULL END,
                CASE WHEN random() > 0.7 THEN 'Social media was distracting today. Need to limit usage.' ELSE NULL END,
                CASE WHEN random() > 0.5 THEN 
                    'Today was productive. Focused on priorities and completed most tasks. Need to work on evening routine.'
                ELSE NULL END
            )
            ON CONFLICT (user_id, date) DO UPDATE SET
                lessons = EXCLUDED.lessons,
                ideas = EXCLUDED.ideas,
                notes = EXCLUDED.notes,
                distractions = EXCLUDED.distractions,
                reflection = EXCLUDED.reflection,
                updated_at = NOW();
        END IF;
        
        -- Calculate and insert daily scores (using UPSERT to handle duplicates)
        -- This is a simplified calculation - in production, you'd calculate based on actual entries
        INSERT INTO habit_daily_scores (
            user_id, date, score_overall, grade,
            score_habits, score_priorities, score_todos,
            score_physical, score_mental, score_spiritual,
            score_morning, score_afternoon, score_evening
        )
        SELECT 
            sample_user_id,
            entry_date,
            -- Overall score: varies between 60-95
            overall_score,
            -- Grade based on score
            CASE 
                WHEN overall_score >= 90 THEN 'A'
                WHEN overall_score >= 80 THEN 'B'
                WHEN overall_score >= 70 THEN 'C'
                WHEN overall_score >= 60 THEN 'D'
                ELSE 'F'
            END,
            -- Component scores
            65 + floor(random() * 30)::int,  -- habits
            70 + floor(random() * 25)::int,  -- priorities
            75 + floor(random() * 20)::int,  -- todos
            -- Category scores
            60 + floor(random() * 35)::int,  -- physical
            65 + floor(random() * 30)::int,  -- mental
            70 + floor(random() * 25)::int,  -- spiritual
            -- Time of day scores
            75 + floor(random() * 20)::int,  -- morning (usually best)
            65 + floor(random() * 30)::int,  -- afternoon
            60 + floor(random() * 35)::int   -- evening (usually worst)
        FROM (
            SELECT 60 + floor(random() * 35)::int AS overall_score
        ) AS score_calc
        ON CONFLICT (user_id, date) DO UPDATE SET
            score_overall = EXCLUDED.score_overall,
            grade = EXCLUDED.grade,
            score_habits = EXCLUDED.score_habits,
            score_priorities = EXCLUDED.score_priorities,
            score_todos = EXCLUDED.score_todos,
            score_physical = EXCLUDED.score_physical,
            score_mental = EXCLUDED.score_mental,
            score_spiritual = EXCLUDED.score_spiritual,
            score_morning = EXCLUDED.score_morning,
            score_afternoon = EXCLUDED.score_afternoon,
            score_evening = EXCLUDED.score_evening,
            updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE 'Sample data created successfully for November 2024!';
    RAISE NOTICE 'Created goals, habits, bad habits, milestones, and daily entries for 30 days.';
    
END $$;

