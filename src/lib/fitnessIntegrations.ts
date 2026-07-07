/**
 * Fitness integration service — Fitbit OAuth + sync, with stubs for other providers.
 */

import { supabase } from '@auth/supabaseClient';

type Provider =
    | 'apple_health'
    | 'fitbit'
    | 'myfitnesspal'
    | 'cronometer'
    | 'health_connect'
    | 'google_health'
    | 'other';

export type FitnessConnectionSummary = {
    provider: string;
    status: 'connected' | 'disconnected' | 'coming_soon';
    last_synced_at: string | null;
    error_code: string | null;
    error_message: string | null;
    external_user_id: string | null;
};

/**
 * Load integration status merged with provider connection metadata.
 */
export async function loadFitnessConnections(): Promise<FitnessConnectionSummary[]> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const [integrationsResult, connectionsResult] = await Promise.all([
        supabase.from('fitness_integrations').select('provider, status, last_synced_at').eq('user_id', user.id),
        supabase
            .from('fitness_provider_connections')
            .select('provider, last_successful_sync_at, error_code, error_message, external_user_id')
            .eq('user_id', user.id),
    ]);

    if (integrationsResult.error) {
        throw new Error(integrationsResult.error.message);
    }
    if (connectionsResult.error) {
        throw new Error(connectionsResult.error.message);
    }

    const integrationMap = new Map(
        (integrationsResult.data ?? []).map(row => [row.provider, row])
    );
    const connectionMap = new Map(
        (connectionsResult.data ?? []).map(row => [row.provider, row])
    );

    const providers: Provider[] = [
        'apple_health',
        'fitbit',
        'health_connect',
        'myfitnesspal',
        'cronometer',
    ];

    return providers.map(provider => {
        const integration = integrationMap.get(provider);
        const connection = connectionMap.get(provider);

        const lastSynced =
            connection?.last_successful_sync_at ?? integration?.last_synced_at ?? null;

        let status: FitnessConnectionSummary['status'] = integration?.status ?? 'disconnected';
        if (connection && status !== 'connected') {
            status = 'connected';
        }

        return {
            provider,
            status,
            last_synced_at: lastSynced,
            error_code: connection?.error_code ?? null,
            error_message: connection?.error_message ?? null,
            external_user_id: connection?.external_user_id ?? null,
        };
    });
}

/**
 * Start Fitbit OAuth — redirects to the server authorize route.
 */
export function connectFitbit(): void {
    window.location.href = '/api/fitness/fitbit/oauth/authorize';
}

/**
 * Disconnect Fitbit — revokes tokens server-side.
 */
export async function disconnectFitbit(): Promise<void> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
        throw new Error('Not authenticated');
    }

    const response = await fetch('/api/fitness/fitbit/disconnect', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to disconnect Fitbit');
    }
}

/**
 * Manually sync Fitbit data for the current user.
 */
export async function syncFitbit(): Promise<string> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
        throw new Error('Not authenticated');
    }

    const response = await fetch('/api/fitness/fitbit/sync', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ register_webhooks: true, backfill_days: 7 }),
    });

    const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
    };

    if (!response.ok) {
        throw new Error(body.error ?? 'Fitbit sync failed');
    }

    return body.message ?? 'Sync complete';
}

/**
 * Legacy stub connect for providers not yet implemented.
 */
export async function connectIntegration(provider: Provider | string): Promise<void> {
    if (provider === 'fitbit') {
        connectFitbit();
        return;
    }

    throw new Error(`${provider} integration is not yet available`);
}

/**
 * Legacy disconnect — routes Fitbit to real disconnect.
 */
export async function disconnectIntegration(provider: Provider | string): Promise<void> {
    if (provider === 'fitbit') {
        await disconnectFitbit();
        return;
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Not authenticated');
    }

    const { error } = await supabase
        .from('fitness_integrations')
        .update({
            status: 'disconnected',
            last_synced_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('provider', provider);

    if (error) {
        throw new Error(`Failed to disconnect ${provider}: ${error.message}`);
    }
}

export async function importWorkoutsFromProvider(
    _provider: Provider | string,
    _startDate: string,
    _endDate: string
): Promise<void> {
    if (_provider === 'fitbit') {
        await syncFitbit();
        return;
    }

    throw new Error('importWorkoutsFromProvider is not yet implemented for this provider');
}

export async function importMealsFromProvider(
    _provider: Provider | string,
    _startDate: string,
    _endDate: string
): Promise<void> {
    throw new Error('importMealsFromProvider is not yet implemented');
}

export async function syncAllIntegrations(): Promise<void> {
    await syncFitbit();
}
