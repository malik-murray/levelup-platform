import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { registerFitbitSubscriptions } from '@/lib/fitbit/registerFitbitSubscriptions';
import { syncAllFitbitConnectionsForUser } from '@/lib/fitbit/syncAllFitbitConnectionsForUser';
import type { FitbitProviderConnection } from '@/lib/fitbit/types';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Manually sync all Fitbit connections for the authenticated user.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as {
            register_webhooks?: boolean;
            backfill_days?: number;
        };

        if (body.register_webhooks !== false) {
            const { data: connections } = await auth.supabase
                .from('fitness_provider_connections')
                .select('*')
                .eq('user_id', auth.user.id)
                .eq('provider', 'fitbit');

            for (const connection of (connections ?? []) as FitbitProviderConnection[]) {
                await registerFitbitSubscriptions(auth.supabase, connection);
            }
        }

        const summary = await syncAllFitbitConnectionsForUser(auth.supabase, auth.user.id, {
            backfillDays: body.backfill_days ?? 7,
            triggeredBy: 'manual',
        });

        const totalSteps = summary.results.reduce((sum, r) => sum + r.steps_days, 0);
        const totalWorkouts = summary.results.reduce((sum, r) => sum + r.workouts, 0);

        return NextResponse.json({
            success: summary.failed === 0,
            ...summary,
            message:
                totalSteps > 0 || totalWorkouts > 0
                    ? `Synced ${totalSteps} day(s) of metrics and ${totalWorkouts} workout(s)`
                    : 'Fitbit is up to date',
        });
    } catch (error) {
        console.error('[fitbit-sync]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Sync failed' },
            { status: 500 }
        );
    }
}
