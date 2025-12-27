-- Migration: Create emotional test tables
-- This migration creates tables for emotional tests, questions, responses, reflections, and results

-- Table: emotional_tests
-- Stores test definitions
CREATE TABLE IF NOT EXISTS emotional_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Emotional Assessment',
    description TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: emotional_test_questions
-- Stores test questions (both multiple-choice and scenario-based)
CREATE TABLE IF NOT EXISTS emotional_test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES emotional_tests(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'scenario')),
    question_text TEXT NOT NULL,
    scenario_description TEXT, -- For scenario-based questions
    options JSONB, -- For multiple-choice: [{"id": "a", "text": "Option A", "value": 1}, ...]
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: emotional_test_responses
-- Stores user's multiple-choice answers
CREATE TABLE IF NOT EXISTS emotional_test_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES emotional_tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES emotional_test_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    selected_option_id TEXT, -- The option ID they selected
    selected_option_value INTEGER, -- The numeric value of the selected option
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_id, question_id, user_id)
);

-- Table: emotional_test_reflections
-- Stores user's written reflections for scenario-based questions
CREATE TABLE IF NOT EXISTS emotional_test_reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES emotional_tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES emotional_test_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reflection_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_id, question_id, user_id)
);

-- Table: emotional_test_results
-- Stores AI-generated summaries and resolutions
CREATE TABLE IF NOT EXISTS emotional_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES emotional_tests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL, -- AI-generated personalized summary
    emotional_traits JSONB, -- Extracted emotional traits/patterns
    resolutions TEXT NOT NULL, -- AI-generated tailored resolutions/tips
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emotional_tests_user_id ON emotional_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_emotional_tests_completed_at ON emotional_tests(completed_at);
CREATE INDEX IF NOT EXISTS idx_emotional_test_questions_test_id ON emotional_test_questions(test_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_questions_order ON emotional_test_questions(test_id, order_index);
CREATE INDEX IF NOT EXISTS idx_emotional_test_responses_test_id ON emotional_test_responses(test_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_responses_user_id ON emotional_test_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_responses_question_id ON emotional_test_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_reflections_test_id ON emotional_test_reflections(test_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_reflections_user_id ON emotional_test_reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_reflections_question_id ON emotional_test_reflections(question_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_results_test_id ON emotional_test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_emotional_test_results_user_id ON emotional_test_results(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE emotional_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_test_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_test_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for emotional_tests
CREATE POLICY "Users can view their own emotional tests"
    ON emotional_tests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own emotional tests"
    ON emotional_tests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emotional tests"
    ON emotional_tests FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emotional tests"
    ON emotional_tests FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for emotional_test_questions
CREATE POLICY "Users can view questions for their tests"
    ON emotional_test_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM emotional_tests
            WHERE emotional_tests.id = emotional_test_questions.test_id
            AND emotional_tests.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert questions for their tests"
    ON emotional_test_questions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM emotional_tests
            WHERE emotional_tests.id = emotional_test_questions.test_id
            AND emotional_tests.user_id = auth.uid()
        )
    );

-- RLS Policies for emotional_test_responses
CREATE POLICY "Users can view their own responses"
    ON emotional_test_responses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own responses"
    ON emotional_test_responses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
    ON emotional_test_responses FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for emotional_test_reflections
CREATE POLICY "Users can view their own reflections"
    ON emotional_test_reflections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reflections"
    ON emotional_test_reflections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reflections"
    ON emotional_test_reflections FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for emotional_test_results
CREATE POLICY "Users can view their own test results"
    ON emotional_test_results FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test results"
    ON emotional_test_results FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test results"
    ON emotional_test_results FOR UPDATE
    USING (auth.uid() = user_id);







