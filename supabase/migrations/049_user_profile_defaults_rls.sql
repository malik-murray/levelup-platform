-- RLS for resume master profile (PostgREST exposure)
ALTER TABLE user_profile_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile defaults"
    ON user_profile_defaults FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile defaults"
    ON user_profile_defaults FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile defaults"
    ON user_profile_defaults FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile defaults"
    ON user_profile_defaults FOR DELETE
    USING (auth.uid() = user_id);
