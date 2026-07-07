import type { SupabaseClient } from '@supabase/supabase-js';
import { getFitbitWebhookUrl } from './fitbitConfig';
import { ensureValidFitbitToken, registerFitbitSubscription } from './fitbitApi';
import type { FitbitProviderConnection } from './types';

const FITBIT_SUBSCRIPTIONS = ['activities', 'sleep', 'body'] as const;

export async function registerFitbitSubscriptions(
    supabase: SupabaseClient,
    connection: FitbitProviderConnection
): Promise<{ registered: string[]; failed: string[] }> {
    const webhookUrl = getFitbitWebhookUrl();
    if (!webhookUrl) {
        return { registered: [], failed: FITBIT_SUBSCRIPTIONS.slice() };
    }

    const activeConnection = await ensureValidFitbitToken(supabase, connection);
    const subscriberId = activeConnection.id.replace(/-/g, '').slice(0, 50);
    const registered: string[] = [];
    const failed: string[] = [];

    for (const collection of FITBIT_SUBSCRIPTIONS) {
        try {
            await registerFitbitSubscription(activeConnection.access_token, collection, subscriberId);
            registered.push(collection);
        } catch (err) {
            console.warn('[fitbit] subscription failed:', collection, err);
            failed.push(collection);
        }
    }

    return { registered, failed };
}
