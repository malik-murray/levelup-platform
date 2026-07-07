import type { SupabaseClient } from '@supabase/supabase-js';
import {
    FITBIT_API_BASE,
    FITBIT_REVOKE_URL,
    FITBIT_TOKEN_URL,
    getFitbitRedirectUri,
} from './fitbitConfig';
import type { FitbitProviderConnection, FitbitTokenResponse } from './types';

type FitbitRequestOptions = {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: URLSearchParams | Record<string, unknown>;
    contentType?: 'form' | 'json';
};

export class FitbitApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string
    ) {
        super(message);
        this.name = 'FitbitApiError';
    }
}

function getBasicAuthHeader(): string {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET must be set');
    }
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function parseFitbitResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text) {
        try {
            data = JSON.parse(text) as Record<string, unknown>;
        } catch {
            data = { raw: text };
        }
    }

    if (!response.ok) {
        const errors = data.errors as Array<{ errorType?: string; message?: string }> | undefined;
        const message =
            errors?.[0]?.message ||
            (typeof data.message === 'string' ? data.message : null) ||
            `Fitbit API error (${response.status})`;
        throw new FitbitApiError(message, response.status, errors?.[0]?.errorType);
    }

    return data as T;
}

export async function exchangeFitbitCode(code: string): Promise<FitbitTokenResponse> {
    const body = new URLSearchParams({
        client_id: process.env.FITBIT_CLIENT_ID!,
        grant_type: 'authorization_code',
        redirect_uri: getFitbitRedirectUri(),
        code,
    });

    const response = await fetch(FITBIT_TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: getBasicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });

    return parseFitbitResponse<FitbitTokenResponse>(response);
}

export async function refreshFitbitToken(refreshToken: string): Promise<FitbitTokenResponse> {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });

    const response = await fetch(FITBIT_TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: getBasicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });

    return parseFitbitResponse<FitbitTokenResponse>(response);
}

export async function revokeFitbitToken(token: string): Promise<void> {
    const body = new URLSearchParams({ token });
    const response = await fetch(FITBIT_REVOKE_URL, {
        method: 'POST',
        headers: {
            Authorization: getBasicAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });

    if (!response.ok) {
        const text = await response.text();
        console.warn('[fitbit] token revoke failed:', text);
    }
}

export async function ensureValidFitbitToken(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection
): Promise<FitbitProviderConnection> {
    const expiresAt = connection.token_expires_at
        ? new Date(connection.token_expires_at).getTime()
        : 0;
    const needsRefresh = !expiresAt || Date.now() > expiresAt - 60_000;

    if (!needsRefresh) {
        return connection;
    }

    if (!connection.refresh_token) {
        throw new FitbitApiError('Fitbit token expired and no refresh token available', 401, 'invalid_token');
    }

    const tokens = await refreshFitbitToken(connection.refresh_token);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { data, error } = await supabase
        .from('fitness_provider_connections')
        .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt,
            scopes: tokens.scope.split(' '),
            updated_at: new Date().toISOString(),
            error_code: null,
            error_message: null,
        })
        .eq('id', connection.id)
        .select('*')
        .single();

    if (error || !data) {
        throw new Error(`Failed to refresh Fitbit token: ${error?.message ?? 'unknown error'}`);
    }

    return data as FitbitProviderConnection;
}

export async function fitbitApiRequest<T>(
    accessToken: string,
    path: string,
    options?: FitbitRequestOptions
): Promise<T> {
    const method = options?.method ?? 'GET';
    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
    };

    let body: string | undefined;
    if (options?.body) {
        if (options.body instanceof URLSearchParams) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            body = options.body.toString();
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(options.body);
        }
    } else if (method === 'POST') {
        headers['Content-Length'] = '0';
    }

    const response = await fetch(`${FITBIT_API_BASE}${path}`, {
        method,
        headers,
        body,
    });

    return parseFitbitResponse<T>(response);
}

export async function registerFitbitSubscription(
    accessToken: string,
    collectionPath: string,
    subscriptionId: string
): Promise<void> {
    await fitbitApiRequest(accessToken, `/1/user/-/${collectionPath}/apiSubscriptions/${subscriptionId}.json`, {
        method: 'POST',
    });
}

export async function deleteFitbitSubscription(
    accessToken: string,
    collectionPath: string,
    subscriptionId: string
): Promise<void> {
    try {
        await fitbitApiRequest(accessToken, `/1/user/-/${collectionPath}/apiSubscriptions/${subscriptionId}.json`, {
            method: 'DELETE',
        });
    } catch (err) {
        if (err instanceof FitbitApiError && err.status === 404) {
            return;
        }
        throw err;
    }
}
