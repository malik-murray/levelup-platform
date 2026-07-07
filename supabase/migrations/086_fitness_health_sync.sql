-- Migration: Fitness health provider sync (Fitbit, Health Connect, etc.)
-- Adds OAuth connection storage, vital samples, and source attribution on daily metrics.

-- Extend provider enum on fitness_integrations
ALTER TABLE fitness_integrations
    DROP CONSTRAINT IF EXISTS fitness_integrations_provider_check;

ALTER TABLE fitness_integrations
    ADD CONSTRAINT fitness_integrations_provider_check
    CHECK (provider IN (
        'apple_health',
        'fitbit',
        'myfitnesspal',
        'cronometer',
        'health_connect',
        'google_health',
        'other'
    ));

-- OAuth connections (modeled on plaid_items)
CREATE TABLE IF NOT EXISTS fitness_provider_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN (
        'fitbit',
        'health_connect',
        'apple_health',
        'google_health',
        'other'
    )),
    external_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[],
    sync_cursor JSONB NOT NULL DEFAULT '{}',
    last_successful_sync_at TIMESTAMPTZ,
    last_webhook_at TIMESTAMPTZ,
    last_cron_sync_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_fitness_provider_connections_user_id
    ON fitness_provider_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_fitness_provider_connections_provider
    ON fitness_provider_connections(provider);

CREATE INDEX IF NOT EXISTS idx_fitness_provider_connections_external_user_id
    ON fitness_provider_connections(external_user_id);

-- Time-series vitals (heart rate, resting HR, HRV)
CREATE TABLE IF NOT EXISTS fitness_vital_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    source_id TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'heart_rate',
        'resting_hr',
        'hrv'
    )),
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider, source_id)
);

CREATE INDEX IF NOT EXISTS idx_fitness_vital_samples_user_recorded
    ON fitness_vital_samples(user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_fitness_vital_samples_user_type
    ON fitness_vital_samples(user_id, metric_type, recorded_at DESC);

-- Source attribution on daily metrics
ALTER TABLE fitness_metrics
    ADD COLUMN IF NOT EXISTS steps_source TEXT,
    ADD COLUMN IF NOT EXISTS sleep_source TEXT,
    ADD COLUMN IF NOT EXISTS weight_source TEXT;

-- Dedup synced workouts by provider + external id
CREATE UNIQUE INDEX IF NOT EXISTS idx_fitness_workouts_provider_source
    ON fitness_workouts(user_id, source, source_id)
    WHERE source_id IS NOT NULL;

-- RLS
ALTER TABLE fitness_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_vital_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fitness provider connections"
    ON fitness_provider_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fitness provider connections"
    ON fitness_provider_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fitness provider connections"
    ON fitness_provider_connections FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fitness provider connections"
    ON fitness_provider_connections FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own vital samples"
    ON fitness_vital_samples FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vital samples"
    ON fitness_vital_samples FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vital samples"
    ON fitness_vital_samples FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vital samples"
    ON fitness_vital_samples FOR DELETE
    USING (auth.uid() = user_id);
