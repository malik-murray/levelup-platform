-- Migration: Create fitness tracking tables
-- This migration creates tables for workouts, meals, metrics, goals, and integrations

-- Table: fitness_workouts
CREATE TABLE IF NOT EXISTS fitness_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('strength', 'cardio', 'mobility', 'sport', 'other')),
    muscle_group TEXT,
    duration_minutes INTEGER NOT NULL,
    intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
    calories_burned INTEGER,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'apple_watch', 'fitbit', 'other')),
    source_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: fitness_meals
CREATE TABLE IF NOT EXISTS fitness_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    description TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein_g NUMERIC(6, 2),
    carbs_g NUMERIC(6, 2),
    fat_g NUMERIC(6, 2),
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'app_import')),
    source_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: fitness_metrics
CREATE TABLE IF NOT EXISTS fitness_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg NUMERIC(5, 2),
    steps INTEGER,
    water_ml INTEGER,
    sleep_hours NUMERIC(4, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table: fitness_goals
CREATE TABLE IF NOT EXISTS fitness_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_steps_target INTEGER DEFAULT 10000,
    daily_calories_target INTEGER DEFAULT 2000,
    daily_water_ml_target INTEGER DEFAULT 2500,
    weekly_workout_minutes_target INTEGER DEFAULT 150,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table: fitness_integrations
CREATE TABLE IF NOT EXISTS fitness_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('apple_health', 'fitbit', 'myfitnesspal', 'cronometer', 'other')),
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'coming_soon')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fitness_workouts_user_id ON fitness_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_workouts_date ON fitness_workouts(date);
CREATE INDEX IF NOT EXISTS idx_fitness_meals_user_id ON fitness_meals(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_meals_date ON fitness_meals(date);
CREATE INDEX IF NOT EXISTS idx_fitness_metrics_user_id ON fitness_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_metrics_date ON fitness_metrics(date);
CREATE INDEX IF NOT EXISTS idx_fitness_goals_user_id ON fitness_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_integrations_user_id ON fitness_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_integrations_provider ON fitness_integrations(provider);

-- Enable Row Level Security (RLS)
ALTER TABLE fitness_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view their own workouts"
    ON fitness_workouts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts"
    ON fitness_workouts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
    ON fitness_workouts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
    ON fitness_workouts FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own meals"
    ON fitness_meals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meals"
    ON fitness_meals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meals"
    ON fitness_meals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meals"
    ON fitness_meals FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own metrics"
    ON fitness_metrics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own metrics"
    ON fitness_metrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own metrics"
    ON fitness_metrics FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own metrics"
    ON fitness_metrics FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own goals"
    ON fitness_goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
    ON fitness_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
    ON fitness_goals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own integrations"
    ON fitness_integrations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
    ON fitness_integrations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
    ON fitness_integrations FOR UPDATE
    USING (auth.uid() = user_id);











