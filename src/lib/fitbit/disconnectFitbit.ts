import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteFitbitSubscription, revokeFitbitToken } from './fitbitApi';
import type { FitbitProviderConnection } from './types';

const FITBIT_SUBSCRIPTIONS = ['activities', 'sleep', 'body'] as const;

export async function disconnectFitbitConnection(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection
): Promise<void> {
    const subscriberId = connection.id.replace(/-/g, '').slice(0, 50);

    for (const collection of FITBIT_SUBSCRIPTIONS) {
        try {
            await deleteFitbitSubscription(connection.access_token, collection, subscriberId);
        } catch (err) {
            console.warn('[fitbit] unsubscribe failed:', collection, err);
        }
    }

    const tokenToRevoke = connection.refresh_token ?? connection.access_token;
    await revokeFitbitToken(tokenToRevoke);

    await supabase.from('fitness_provider_connections').delete().eq('id', connection.id);

    await supabase
        .from('fitness_integrations')
        .update({
            status: 'disconnected',
            last_synced_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('user_id', connection.user_id)
        .eq('provider', 'fitbit');
}
