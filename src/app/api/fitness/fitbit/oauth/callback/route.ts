import { NextRequest, NextResponse } from 'next/server';
import { exchangeFitbitCode } from '@/lib/fitbit/fitbitApi';
import { verifyFitbitOAuthState } from '@/lib/fitbit/oauthState';
import { registerFitbitSubscriptions } from '@/lib/fitbit/registerFitbitSubscriptions';
import { syncFitbitConnection } from '@/lib/fitbit/syncFitbitConnection';
import { getServiceRoleSupabase } from '@/lib/auth/getAuthenticatedUser';
import type { FitbitProviderConnection } from '@/lib/fitbit/types';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Fitbit OAuth callback — exchanges code for tokens, stores connection, runs initial sync.
 */
export async function GET(request: NextRequest) {
    const integrationsUrl = new URL('/fitness/settings/integrations', request.url);
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const fitbitError = request.nextUrl.searchParams.get('error');

    if (fitbitError) {
        integrationsUrl.searchParams.set('fitbit', 'error');
        integrationsUrl.searchParams.set('message', fitbitError);
        return NextResponse.redirect(integrationsUrl);
    }

    if (!code || !state) {
        integrationsUrl.searchParams.set('fitbit', 'error');
        integrationsUrl.searchParams.set('message', 'missing_code_or_state');
        return NextResponse.redirect(integrationsUrl);
    }

    try {
        const userId = await verifyFitbitOAuthState(state);
        const tokens = await exchangeFitbitCode(code);
        const supabase = getServiceRoleSupabase();
        const now = new Date().toISOString();
        const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        const { data: connection, error: upsertError } = await supabase
            .from('fitness_provider_connections')
            .upsert(
                {
                    user_id: userId,
                    provider: 'fitbit',
                    external_user_id: tokens.user_id,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: tokenExpiresAt,
                    scopes: tokens.scope.split(' '),
                    sync_cursor: {},
                    error_code: null,
                    error_message: null,
                    updated_at: now,
                },
                { onConflict: 'user_id,provider' }
            )
            .select('*')
            .single();

        if (upsertError || !connection) {
            throw new Error(upsertError?.message ?? 'Failed to save Fitbit connection');
        }

        await supabase.from('fitness_integrations').upsert(
            {
                user_id: userId,
                provider: 'fitbit',
                status: 'connected',
                last_synced_at: null,
                updated_at: now,
            },
            { onConflict: 'user_id,provider' }
        );

        const subscriptionResult = await registerFitbitSubscriptions(
            supabase,
            connection as FitbitProviderConnection
        );

        await syncFitbitConnection(supabase, connection as FitbitProviderConnection, {
            backfillDays: 30,
            triggeredBy: 'oauth',
        });

        integrationsUrl.searchParams.set('fitbit', 'connected');
        if (subscriptionResult.failed.length > 0) {
            integrationsUrl.searchParams.set('webhook_warning', '1');
        }

        return NextResponse.redirect(integrationsUrl);
    } catch (err) {
        console.error('[fitbit-oauth-callback]', err);
        integrationsUrl.searchParams.set('fitbit', 'error');
        integrationsUrl.searchParams.set(
            'message',
            err instanceof Error ? err.message : 'oauth_callback_failed'
        );
        return NextResponse.redirect(integrationsUrl);
    }
}
