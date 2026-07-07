import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { disconnectFitbitConnection } from '@/lib/fitbit/disconnectFitbit';
import type { FitbitProviderConnection } from '@/lib/fitbit/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Disconnect Fitbit — revokes tokens and removes the provider connection.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: connection, error } = await auth.supabase
            .from('fitness_provider_connections')
            .select('*')
            .eq('user_id', auth.user.id)
            .eq('provider', 'fitbit')
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!connection) {
            await auth.supabase
                .from('fitness_integrations')
                .update({
                    status: 'disconnected',
                    last_synced_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', auth.user.id)
                .eq('provider', 'fitbit');

            return NextResponse.json({ success: true, message: 'Fitbit already disconnected' });
        }

        await disconnectFitbitConnection(auth.supabase, connection as FitbitProviderConnection);

        return NextResponse.json({ success: true, message: 'Fitbit disconnected' });
    } catch (error) {
        console.error('[fitbit-disconnect]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Disconnect failed' },
            { status: 500 }
        );
    }
}
