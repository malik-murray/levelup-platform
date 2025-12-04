-- Migration: Insert Master Goals, Sub-Goals, Habits, and Milestones
-- This migration inserts comprehensive goal data for Financial, Physical, Business, and Personal Development goals

DO $$
DECLARE
    sample_user_id UUID;
    -- Main Goals
    goal_financial_id UUID;
    goal_physical_id UUID;
    goal_business_id UUID;
    goal_leader_id UUID;
    -- Sub-goals (Financial)
    subgoal_income_id UUID;
    subgoal_budgeting_id UUID;
    subgoal_investing_id UUID;
    subgoal_emergency_id UUID;
    -- Sub-goals (Physical)
    subgoal_morning_id UUID;
    subgoal_nutrition_id UUID;
    subgoal_training_id UUID;
    subgoal_flexibility_id UUID;
    subgoal_cardio_id UUID;
    subgoal_sleep_id UUID;
    -- Sub-goals (Business)
    subgoal_habit_app_id UUID;
    subgoal_finance_app_id UUID;
    subgoal_ebook_id UUID;
    subgoal_analyzer_id UUID;
    subgoal_generator_id UUID;
    subgoal_publisher_id UUID;
    subgoal_grow_channels_id UUID;
    -- Sub-goals (Leader)
    subgoal_disciplined_id UUID;
    subgoal_intentional_id UUID;
    subgoal_lighthearted_id UUID;
    subgoal_best_outcome_id UUID;
    subgoal_shine_light_id UUID;
    subgoal_master_thoughts_id UUID;
    subgoal_create_life_id UUID;
BEGIN
    -- Get the first user
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    
    IF sample_user_id IS NULL THEN
        RAISE NOTICE 'No users found. Please create a user first.';
        RETURN;
    END IF;

    -- ============================================
    -- MASTER GOAL 1: FINANCIAL
    -- ============================================
    INSERT INTO habit_goals (user_id, name, description, category, target_value, target_unit, current_value)
    VALUES (sample_user_id, 'Reach $250,000 Net Worth', 'Build wealth through income growth, consistent investing, and financial discipline', 'financial', 250000, 'USD', 0)
    RETURNING id INTO goal_financial_id;

    -- Financial Sub-Goals
    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id, target_value, target_unit)
    VALUES 
        (sample_user_id, 'Increase income to $5,000+/month', 'Grow monthly income to support financial goals', 'financial', goal_financial_id, 5000, 'USD/month')
    RETURNING id INTO subgoal_income_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Maintain consistent budgeting & financial tracking', 'Stay on top of finances with regular tracking', 'financial', goal_financial_id)
    RETURNING id INTO subgoal_budgeting_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Invest consistently with recurring contributions', 'Build wealth through automated investing', 'financial', goal_financial_id)
    RETURNING id INTO subgoal_investing_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id, target_value, target_unit)
    VALUES 
        (sample_user_id, 'Build emergency fund + reduce unnecessary spending', 'Create financial safety net', 'financial', goal_financial_id, 12000, 'USD')
    RETURNING id INTO subgoal_emergency_id;

    -- Financial Habits
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Update budget daily', '💰', 'mental', 'evening', goal_financial_id, false, true, 1),
        (sample_user_id, 'Review & categorize expenses', '📊', 'mental', 'evening', goal_financial_id, false, true, 2),
        (sample_user_id, 'Weekly zero-based budget review', '📋', 'mental', 'evening', goal_financial_id, false, true, 3),
        (sample_user_id, 'Automated/recurring investments each payday', '💵', 'mental', 'morning', goal_financial_id, false, true, 4),
        (sample_user_id, 'Weekly investment account check', '📈', 'mental', 'morning', goal_financial_id, false, true, 5),
        (sample_user_id, 'Review income opportunities weekly', '💼', 'mental', 'morning', goal_financial_id, false, true, 6),
        (sample_user_id, 'Track spending categories', '📝', 'mental', 'evening', goal_financial_id, false, true, 7);

    -- Financial Milestones
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_financial_id, 'Budget / Tracking - Streak', to_jsonb(ARRAY[7, 14, 30, 90]::numeric[])),
        (sample_user_id, goal_financial_id, 'Income - Monthly', to_jsonb(ARRAY[4000, 5000]::numeric[])),
        (sample_user_id, goal_financial_id, 'Investments - Total', to_jsonb(ARRAY[10000, 25000, 50000, 100000]::numeric[])),
        (sample_user_id, goal_financial_id, 'Net Worth', to_jsonb(ARRAY[50000, 100000, 150000, 200000, 250000]::numeric[])),
        (sample_user_id, goal_financial_id, 'Emergency Fund', to_jsonb(ARRAY[12000]::numeric[]));

    -- ============================================
    -- MASTER GOAL 2: PHYSICAL
    -- ============================================
    INSERT INTO habit_goals (user_id, name, description, category, target_value, target_unit)
    VALUES (sample_user_id, 'Become a Physical God', 'Elite Strength, Flexibility, Endurance, Health', 'physical', 165, 'lbs')
    RETURNING id INTO goal_physical_id;

    -- Physical Sub-Goals
    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Elite Morning Discipline', 'Master morning routine for peak performance', 'physical', goal_physical_id)
    RETURNING id INTO subgoal_morning_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Elite Nutrition & Supplements', 'Optimize nutrition for performance', 'physical', goal_physical_id)
    RETURNING id INTO subgoal_nutrition_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Elite Training Consistency', 'Gym + Calisthenics training', 'physical', goal_physical_id)
    RETURNING id INTO subgoal_training_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Elite Flexibility & Mobility', 'Maintain and improve flexibility', 'physical', goal_physical_id)
    RETURNING id INTO subgoal_flexibility_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Elite Cardiovascular Endurance', 'Build elite cardio capacity', 'physical', goal_physical_id)
    RETURNING id INTO subgoal_cardio_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Elite Sleep Discipline', 'Optimize sleep for recovery', 'physical', goal_physical_id)
    RETURNING id INTO subgoal_sleep_id;

    -- Physical Habits - Morning Discipline
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Wake up 3:30AM', '🌅', 'physical', 'morning', goal_physical_id, false, true, 1),
        (sample_user_id, 'Meditate (15 minutes)', '🧘', 'spiritual', 'morning', goal_physical_id, false, true, 2),
        (sample_user_id, 'Pray/Gratitude (10 minutes)', '🙏', 'spiritual', 'morning', goal_physical_id, false, true, 3),
        (sample_user_id, 'Manifest (5 minutes)', '✨', 'spiritual', 'morning', goal_physical_id, false, true, 4),
        (sample_user_id, 'Morning self-care', '💆', 'physical', 'morning', goal_physical_id, false, true, 5);

    -- Physical Habits - Nutrition & Health
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Stick to meal plan', '🍽️', 'physical', null, goal_physical_id, false, true, 6),
        (sample_user_id, 'Daily vitamins + supplements', '💊', 'physical', 'morning', goal_physical_id, false, true, 7),
        (sample_user_id, 'Weekly 24-hour fast', '⏰', 'physical', null, goal_physical_id, false, true, 8);

    -- Physical Habits - Training
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Workout', '💪', 'physical', null, goal_physical_id, false, true, 9),
        (sample_user_id, 'Stretch daily', '🧘‍♂️', 'physical', null, goal_physical_id, false, true, 10),
        (sample_user_id, 'Deep stretch session', '🤸', 'physical', 'evening', goal_physical_id, false, true, 11),
        (sample_user_id, 'Cardio daily', '🏃', 'physical', null, goal_physical_id, false, true, 12),
        (sample_user_id, 'Grounding/Nature walk', '🌲', 'physical', null, goal_physical_id, false, true, 13);

    -- Physical Habits - Recovery & Sleep
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Sleep by 10PM', '😴', 'physical', 'evening', goal_physical_id, false, true, 14),
        (sample_user_id, 'Wake 5:30AM', '⏰', 'physical', 'morning', goal_physical_id, false, true, 15),
        (sample_user_id, 'Night self-care', '🛁', 'physical', 'evening', goal_physical_id, false, true, 16);

    -- Physical Habits - Growth & Mindset
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Read 30 minutes', '📚', 'mental', null, goal_physical_id, false, true, 17),
        (sample_user_id, 'Study/Learn', '🎓', 'mental', null, goal_physical_id, false, true, 18),
        (sample_user_id, 'Reflection (journal or audio notes)', '📝', 'mental', 'evening', goal_physical_id, false, true, 19);

    -- Physical Milestones
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_physical_id, 'Workout / Training - Streak', to_jsonb(ARRAY[7, 14, 30]::numeric[])),
        (sample_user_id, goal_physical_id, 'Workout / Training - Total', to_jsonb(ARRAY[50, 100]::numeric[])),
        (sample_user_id, goal_physical_id, 'Flexibility - Streak', to_jsonb(ARRAY[7, 30]::numeric[])),
        (sample_user_id, goal_physical_id, 'Cardio - Distance', to_jsonb(ARRAY[1, 2]::numeric[])),
        (sample_user_id, goal_physical_id, 'Weight Goal', to_jsonb(ARRAY[165]::numeric[])),
        (sample_user_id, goal_physical_id, 'Fasting - Total', to_jsonb(ARRAY[10]::numeric[])),
        (sample_user_id, goal_physical_id, 'Sleep Discipline - Streak', to_jsonb(ARRAY[7, 14, 30]::numeric[]));

    -- ============================================
    -- MASTER GOAL 3: BUSINESS
    -- ============================================
    INSERT INTO habit_goals (user_id, name, description, category, target_value, target_unit)
    VALUES (sample_user_id, 'Build a Fully Automated Multi-Million Dollar Brand Engine', 'A machine that produces content, revenue, and audience growth automatically', 'business', 1000000, 'USD')
    RETURNING id INTO goal_business_id;

    -- Business Sub-Goals
    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Build Habit Tracker App', 'Create and launch habit tracking application', 'business', goal_business_id)
    RETURNING id INTO subgoal_habit_app_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Build Finance App', 'Create financial management application', 'business', goal_business_id)
    RETURNING id INTO subgoal_finance_app_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Publish E-book ("Spiritual Guide to Healing")', 'Write and publish spiritual guide', 'business', goal_business_id)
    RETURNING id INTO subgoal_ebook_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Build Content Analyzer', 'Create tool to analyze content performance', 'business', goal_business_id)
    RETURNING id INTO subgoal_analyzer_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Build Content Generator', 'Create AI-powered content generation tool', 'business', goal_business_id)
    RETURNING id INTO subgoal_generator_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Build Content Publisher/Scheduler', 'Automate content publishing and scheduling', 'business', goal_business_id)
    RETURNING id INTO subgoal_publisher_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'Grow YouTube, TikTok, IG, Facebook channels', 'Build multi-platform audience', 'business', goal_business_id)
    RETURNING id INTO subgoal_grow_channels_id;

    -- Business Habits
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Deep work session daily', '🎯', 'mental', 'morning', goal_business_id, false, true, 1),
        (sample_user_id, 'Study/Learn (business, AI, dev, marketing)', '📚', 'mental', null, goal_business_id, false, true, 2),
        (sample_user_id, 'Research top creators weekly', '🔍', 'mental', null, goal_business_id, false, true, 3),
        (sample_user_id, 'Analyze performance weekly', '📊', 'mental', null, goal_business_id, false, true, 4),
        (sample_user_id, 'Create daily video', '🎥', 'mental', null, goal_business_id, false, true, 5),
        (sample_user_id, 'Write daily (scripts, posts, ideas)', '✍️', 'mental', null, goal_business_id, false, true, 6),
        (sample_user_id, 'Review business metrics daily/weekly', '📈', 'mental', 'evening', goal_business_id, false, true, 7),
        (sample_user_id, 'Community engagement (comments, DM responses)', '💬', 'mental', null, goal_business_id, false, true, 8),
        (sample_user_id, 'Weekly reflection on progress', '🤔', 'mental', 'evening', goal_business_id, false, true, 9);

    -- Business Milestones
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_business_id, 'Product/App Development - Habit Tracker v1', to_jsonb(ARRAY[1]::numeric[])),
        (sample_user_id, goal_business_id, 'Product/App Development - Finance App v1', to_jsonb(ARRAY[1]::numeric[])),
        (sample_user_id, goal_business_id, 'Product/App Development - Content Analyzer', to_jsonb(ARRAY[1]::numeric[])),
        (sample_user_id, goal_business_id, 'Product/App Development - Content Generator', to_jsonb(ARRAY[1]::numeric[])),
        (sample_user_id, goal_business_id, 'Product/App Development - Content Publisher', to_jsonb(ARRAY[1]::numeric[])),
        (sample_user_id, goal_business_id, 'Content & Audience Growth - Followers', to_jsonb(ARRAY[100, 500, 1000, 10000, 100000]::numeric[])),
        (sample_user_id, goal_business_id, 'Content & Audience Growth - Views', to_jsonb(ARRAY[1000000]::numeric[])),
        (sample_user_id, goal_business_id, 'Revenue Milestones', to_jsonb(ARRAY[100, 1000, 10000, 100000]::numeric[])),
        (sample_user_id, goal_business_id, 'Publishing - E-book', to_jsonb(ARRAY[1]::numeric[]));

    -- ============================================
    -- MASTER GOAL 4: BECOME A GREAT MAN & GREAT LEADER
    -- ============================================
    INSERT INTO habit_goals (user_id, name, description, category)
    VALUES (sample_user_id, 'Become a Great Man & Great Leader', 'Core identity/character goal - develop discipline, intentionality, and leadership', 'personal')
    RETURNING id INTO goal_leader_id;

    -- Leader Sub-Goals
    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'BE DISCIPLINED', 'Follow full daily routine consistently', 'personal', goal_leader_id)
    RETURNING id INTO subgoal_disciplined_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'BE INTENTIONAL', 'Act with purpose and intention daily', 'personal', goal_leader_id)
    RETURNING id INTO subgoal_intentional_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'BE LIGHTHEARTED', 'Maintain relaxed, playful attitude', 'personal', goal_leader_id)
    RETURNING id INTO subgoal_lighthearted_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'THINK BEST OUTCOME (STOP OVERTHINKING)', 'Reframe negative thoughts to positive outcomes', 'mental', goal_leader_id)
    RETURNING id INTO subgoal_best_outcome_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'SHINE YOUR LIGHT', 'Lead with confidence and authenticity', 'personal', goal_leader_id)
    RETURNING id INTO subgoal_shine_light_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'MASTER YOUR THOUGHTS', 'Control thoughts, stop loops, practice presence', 'mental', goal_leader_id)
    RETURNING id INTO subgoal_master_thoughts_id;

    INSERT INTO habit_goals (user_id, name, description, category, parent_goal_id)
    VALUES 
        (sample_user_id, 'CREATE YOUR LIFE (I Am, I Create)', 'Visualize and act as the identity you''re creating', 'spiritual', goal_leader_id)
    RETURNING id INTO subgoal_create_life_id;

    -- Leader Habits - BE DISCIPLINED
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Follow full daily routine', '✅', 'mental', null, goal_leader_id, false, true, 1),
        (sample_user_id, 'Do tasks even when unmotivated', '💪', 'mental', null, goal_leader_id, false, true, 2),
        (sample_user_id, 'Limit screens during focus hours', '📵', 'mental', null, goal_leader_id, false, true, 3),
        (sample_user_id, 'Follow habits linked to all major life goals', '🎯', 'mental', null, goal_leader_id, false, true, 4);

    -- Leader Habits - BE INTENTIONAL
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Set 1 daily intention', '🎯', 'mental', 'morning', goal_leader_id, false, true, 5),
        (sample_user_id, 'Choose attitude before interactions', '😊', 'mental', null, goal_leader_id, false, true, 6),
        (sample_user_id, 'Pause → respond, not react', '⏸️', 'mental', null, goal_leader_id, false, true, 7),
        (sample_user_id, 'Nightly review: "Did I act with purpose today?"', '🌙', 'mental', 'evening', goal_leader_id, false, true, 8);

    -- Leader Habits - BE LIGHTHEARTED
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Enter conversations relaxed', '😌', 'mental', null, goal_leader_id, false, true, 9),
        (sample_user_id, 'Smile more, relax shoulders', '😄', 'physical', null, goal_leader_id, false, true, 10),
        (sample_user_id, 'Don''t take mistakes seriously', '🤷', 'mental', null, goal_leader_id, false, true, 11),
        (sample_user_id, 'Use humor/playfulness daily', '😆', 'mental', null, goal_leader_id, false, true, 12);

    -- Leader Habits - THINK BEST OUTCOME
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Reframe negative thoughts to best outcome', '🔄', 'mental', null, goal_leader_id, false, true, 13),
        (sample_user_id, 'Stop at the first thought', '🛑', 'mental', null, goal_leader_id, false, true, 14),
        (sample_user_id, '2–3 minutes presence when overwhelmed', '🧘', 'spiritual', null, goal_leader_id, false, true, 15),
        (sample_user_id, 'Think strategically, not anxiously', '🧠', 'mental', null, goal_leader_id, false, true, 16);

    -- Leader Habits - SHINE YOUR LIGHT
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Confident posture & presence daily', '💪', 'physical', null, goal_leader_id, false, true, 17),
        (sample_user_id, 'Speak with kindness & authenticity', '💬', 'mental', null, goal_leader_id, false, true, 18),
        (sample_user_id, 'Share one positive message daily', '✨', 'mental', null, goal_leader_id, false, true, 19),
        (sample_user_id, 'Do one "best-self action" daily', '🌟', 'mental', null, goal_leader_id, false, true, 20);

    -- Leader Habits - MASTER YOUR THOUGHTS
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Identify first thought → stop the loop', '🔄', 'mental', null, goal_leader_id, false, true, 21),
        (sample_user_id, 'Let thoughts pass without attaching stories', '☁️', 'spiritual', null, goal_leader_id, false, true, 22),
        (sample_user_id, 'Practice presence during walk/shower', '🚶', 'spiritual', null, goal_leader_id, false, true, 23);

    -- Leader Habits - CREATE YOUR LIFE
    INSERT INTO habit_templates (user_id, name, icon, category, time_of_day, goal_id, is_bad_habit, is_active, sort_order)
    VALUES 
        (sample_user_id, 'Visualize desired outcome', '👁️', 'spiritual', 'morning', goal_leader_id, false, true, 24),
        (sample_user_id, 'Act as the identity you''re creating', '🎭', 'mental', null, goal_leader_id, false, true, 25),
        (sample_user_id, 'Weekly routine review', '📋', 'mental', 'evening', goal_leader_id, false, true, 26);

    -- Leader Milestones - BE DISCIPLINED
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_leader_id, 'Discipline - Streak', to_jsonb(ARRAY[7, 14, 30]::numeric[])),
        (sample_user_id, goal_leader_id, 'Discipline - Low Distraction Streak', to_jsonb(ARRAY[14]::numeric[]));

    -- Leader Milestones - BE INTENTIONAL
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_leader_id, 'Intentional - Daily Intention Streak', to_jsonb(ARRAY[7]::numeric[])),
        (sample_user_id, goal_leader_id, 'Intentional - Pause Before Reacting Streak', to_jsonb(ARRAY[14]::numeric[])),
        (sample_user_id, goal_leader_id, 'Intentional - Reflection Streak', to_jsonb(ARRAY[30]::numeric[])),
        (sample_user_id, goal_leader_id, 'Intentional - Interactions', to_jsonb(ARRAY[10]::numeric[]));

    -- Leader Milestones - BE LIGHTHEARTED
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_leader_id, 'Lighthearted - Streak', to_jsonb(ARRAY[7]::numeric[])),
        (sample_user_id, goal_leader_id, 'Lighthearted - Lowered Tension', to_jsonb(ARRAY[14]::numeric[])),
        (sample_user_id, goal_leader_id, 'Lighthearted - Self-Kindness', to_jsonb(ARRAY[30]::numeric[]));

    -- Leader Milestones - THINK BEST OUTCOME
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_leader_id, 'Best Outcome - Reframes', to_jsonb(ARRAY[7]::numeric[])),
        (sample_user_id, goal_leader_id, 'Best Outcome - No Spirals', to_jsonb(ARRAY[14]::numeric[])),
        (sample_user_id, goal_leader_id, 'Best Outcome - Presence Sessions', to_jsonb(ARRAY[30]::numeric[])),
        (sample_user_id, goal_leader_id, 'Best Outcome - Reframed Situations', to_jsonb(ARRAY[10]::numeric[]));

    -- Leader Milestones - SHINE YOUR LIGHT
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_leader_id, 'Shine Light - Confidence Streak', to_jsonb(ARRAY[7]::numeric[])),
        (sample_user_id, goal_leader_id, 'Shine Light - Positive Contributions', to_jsonb(ARRAY[14]::numeric[])),
        (sample_user_id, goal_leader_id, 'Shine Light - Best Version Actions', to_jsonb(ARRAY[30]::numeric[]));

    -- Leader Milestones - MASTER YOUR THOUGHTS
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_leader_id, 'Master Thoughts - Stop First Thought', to_jsonb(ARRAY[7]::numeric[])),
        (sample_user_id, goal_leader_id, 'Master Thoughts - Break Loops', to_jsonb(ARRAY[14]::numeric[])),
        (sample_user_id, goal_leader_id, 'Master Thoughts - Presence Practices', to_jsonb(ARRAY[30]::numeric[]));

    -- Leader Milestones - CREATE YOUR LIFE
    INSERT INTO habit_milestones (user_id, goal_id, name, values)
    VALUES 
        (sample_user_id, goal_leader_id, 'Create Life - Visualization Days', to_jsonb(ARRAY[7]::numeric[])),
        (sample_user_id, goal_leader_id, 'Create Life - Identity-Aligned Actions', to_jsonb(ARRAY[14]::numeric[])),
        (sample_user_id, goal_leader_id, 'Create Life - Weekly Reviews', to_jsonb(ARRAY[4]::numeric[])),
        (sample_user_id, goal_leader_id, 'Create Life - Full Alignment', to_jsonb(ARRAY[30]::numeric[]));

    RAISE NOTICE 'Successfully inserted all master goals, sub-goals, habits, and milestones!';
END $$;

