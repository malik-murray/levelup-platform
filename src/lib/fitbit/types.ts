export type FitbitProviderConnection = {
    id: string;
    user_id: string;
    provider: string;
    external_user_id: string;
    access_token: string;
    refresh_token: string | null;
    token_expires_at: string | null;
    scopes: string[] | null;
    sync_cursor: Record<string, string>;
    last_successful_sync_at: string | null;
    last_webhook_at: string | null;
    last_cron_sync_at: string | null;
    error_code: string | null;
    error_message: string | null;
};

export type FitbitTokenResponse = {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
    user_id: string;
};

export type FitbitSyncResult = {
    connection_id: string;
    success: boolean;
    steps_days: number;
    sleep_days: number;
    weight_days: number;
    workouts: number;
    heart_rate_days: number;
    error?: string;
};

export type FitbitSyncCursor = {
    steps?: string;
    sleep?: string;
    weight?: string;
    workouts?: string;
    heart_rate?: string;
};
