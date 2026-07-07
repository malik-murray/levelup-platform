-- User subscription / access tier for app entitlements
CREATE TABLE IF NOT EXISTS user_app_access (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'full')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_app_access_tier ON user_app_access(tier);

ALTER TABLE user_app_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access tier"
    ON user_app_access FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own access tier"
    ON user_app_access FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own access tier"
    ON user_app_access FOR UPDATE
    USING (auth.uid() = user_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS update_user_app_access_updated_at ON user_app_access;
        CREATE TRIGGER update_user_app_access_updated_at
            BEFORE UPDATE ON user_app_access
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
