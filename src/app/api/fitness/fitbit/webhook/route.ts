import { waitUntil } from '@vercel/functions';
import { NextRequest, NextResponse } from 'next/server';
import { subscriptionIdToConnectionId } from '@/lib/fitbit/fitbitConfig';
import { syncFitbitConnection } from '@/lib/fitbit/syncFitbitConnection';
import { getServiceRoleSupabase } from '@/lib/auth/getAuthenticatedUser';
import type { FitbitProviderConnection } from '@/lib/fitbit/types';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * Fitbit subscriber notifications.
 * Fitbit verifies subscriptions with GET ?verify=<code>.
 */
export async function GET(request: NextRequest) {
    const verify = request.nextUrl.searchParams.get('verify');
    if (verify) {
        return new NextResponse(verify, {
            status: 204,
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    let body: {
        collectionType?: string;
        date?: string;
        ownerId?: string;
        ownerType?: string;
        subscriptionId?: string;
    };

    try {
        body = rawBody ? (JSON.parse(rawBody) as typeof body) : {};
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    console.info('[fitbit-webhook] received', {
        collectionType: body.collectionType,
        date: body.date,
        ownerId: body.ownerId,
        subscriptionId: body.subscriptionId,
    });

    if (!body.subscriptionId) {
        return NextResponse.json({ received: true, ignored: true });
    }

    const connectionId = subscriptionIdToConnectionId(body.subscriptionId);
    if (!connectionId) {
        return NextResponse.json({ received: true, ignored: true });
    }

    waitUntil(
        (async () => {
            try {
                const supabase = getServiceRoleSupabase();
                const { data: connection, error } = await supabase
                    .from('fitness_provider_connections')
                    .select('*')
                    .eq('id', connectionId)
                    .eq('provider', 'fitbit')
                    .maybeSingle();

                if (error || !connection) {
                    console.warn('[fitbit-webhook] connection not found:', connectionId);
                    return;
                }

                await syncFitbitConnection(supabase, connection as FitbitProviderConnection, {
                    backfillDays: 3,
                    triggeredBy: 'webhook',
                });
            } catch (err) {
                console.error('[fitbit-webhook] sync failed:', err);
            }
        })()
    );

    return NextResponse.json({ received: true });
}
