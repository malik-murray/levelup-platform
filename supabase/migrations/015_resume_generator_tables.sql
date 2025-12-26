-- Migration: Create resume generator tables
-- This migration creates tables for the Resume & Cover Letter Generator app

-- Table: user_profile_defaults
-- Stores the master resume data for each user (single row per user)
CREATE TABLE IF NOT EXISTS user_profile_defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    location TEXT,
    summary TEXT, -- Professional summary/profile
    skills JSONB DEFAULT '[]'::jsonb, -- Array of skill objects
    experience JSONB DEFAULT '[]'::jsonb, -- Array of experience objects
    education JSONB DEFAULT '[]'::jsonb, -- Array of education objects
    certifications JSONB DEFAULT '[]'::jsonb, -- Array of certification objects
    projects JSONB DEFAULT '[]'::jsonb, -- Array of project objects
    languages JSONB DEFAULT '[]'::jsonb, -- Array of language objects
    awards JSONB DEFAULT '[]'::jsonb, -- Array of award objects
    service JSONB DEFAULT '[]'::jsonb, -- Array of service/volunteer objects
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: templates
-- Stores resume and cover letter templates
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('resume', 'cover_letter')),
    name TEXT NOT NULL,
    description TEXT,
    layout_config JSONB DEFAULT '{}'::jsonb, -- Section order, fonts, styling config
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_settings
-- Stores user preferences and default settings
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    default_tone TEXT DEFAULT 'professional' CHECK (default_tone IN ('professional', 'federal', 'private', 'internship', 'friendly', 'confident', 'executive')),
    default_job_type TEXT DEFAULT 'private_sector' CHECK (default_job_type IN ('private_sector', 'federal_government', 'internship', 'apprenticeship')),
    default_resume_template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    default_cover_letter_template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    default_header_footer_options JSONB DEFAULT '{}'::jsonb,
    default_visibility_preferences JSONB DEFAULT '{}'::jsonb, -- show_salary, show_awards, etc.
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: credits
-- Tracks user credits/tokens for resume generation
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_credits INTEGER DEFAULT 0 NOT NULL,
    used_credits INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (total_credits >= 0 AND used_credits >= 0 AND used_credits <= total_credits)
);

-- Table: generations
-- Archives each resume/cover letter generation run
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    company_name TEXT,
    job_type TEXT CHECK (job_type IN ('private_sector', 'federal_government', 'internship', 'apprenticeship')),
    resume_template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    cover_letter_template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    tone TEXT,
    options JSONB DEFAULT '{}'::jsonb, -- show_salary, show_service, etc.
    job_description TEXT NOT NULL,
    generated_resume_markdown TEXT, -- Structured resume content (JSON or markdown)
    generated_cover_letter_markdown TEXT, -- Structured cover letter content (JSON or markdown)
    resume_docx_url TEXT, -- URL to stored DOCX file
    cover_letter_docx_url TEXT, -- URL to stored DOCX file
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profile_defaults_user_id ON user_profile_defaults(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_is_default ON templates(is_default);

-- Insert default templates
INSERT INTO templates (type, name, description, is_default, layout_config) VALUES
    ('resume', 'Modern Private Sector', 'Clean, professional resume format optimized for private sector roles', true, '{"sections": ["header", "summary", "experience", "education", "skills", "certifications"], "font": "Arial", "fontSize": 11}'),
    ('resume', 'Federal Government', 'Format optimized for federal government applications (USAJobs compatible)', false, '{"sections": ["header", "summary", "experience", "education", "skills", "certifications", "awards", "service"], "font": "Times New Roman", "fontSize": 12}'),
    ('resume', 'Internship', 'Format tailored for internship and entry-level positions', false, '{"sections": ["header", "summary", "education", "experience", "projects", "skills"], "font": "Arial", "fontSize": 11}'),
    ('cover_letter', 'Professional Standard', 'Traditional professional cover letter format', true, '{"font": "Arial", "fontSize": 11, "paragraphSpacing": 1.15}'),
    ('cover_letter', 'Federal Government', 'Cover letter format for federal applications', false, '{"font": "Times New Roman", "fontSize": 12, "paragraphSpacing": 1.15}'),
    ('cover_letter', 'Modern', 'Contemporary cover letter with modern formatting', false, '{"font": "Arial", "fontSize": 11, "paragraphSpacing": 1.2}')
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profile_defaults_updated_at BEFORE UPDATE ON user_profile_defaults
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credits_updated_at BEFORE UPDATE ON credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



