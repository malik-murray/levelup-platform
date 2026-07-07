import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { ingestHealthSamples } from '@/lib/fitness/healthIngest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sampleSchema = z.object({
    metric_type: z.enum(['steps', 'sleep_hours', 'weight_kg', 'heart_rate', 'resting_hr', 'hrv']),
    value: z.number(),
    date: z.string().optional(),
    recorded_at: z.string().optional(),
    source_id: z.string().min(1),
    unit: z.string().optional(),
});

const ingestSchema = z.object({
    provider: z.enum(['health_connect', 'apple_health', 'google_health', 'other']),
    samples: z.array(sampleSchema).min(1).max(500),
});

/**
 * Ingest health samples from mobile clients (Health Connect, Apple Health, etc.).
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = ingestSchema.parse(await request.json());
        const result = await ingestHealthSamples(auth.supabase, auth.user.id, body);

        return NextResponse.json({
            success: true,
            ...result,
            message: `Ingested ${result.metrics_updated} metric(s) and ${result.vitals_updated} vital sample(s)`,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid payload', details: error.issues }, { status: 400 });
        }

        console.error('[health-ingest]', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Ingest failed' },
            { status: 500 }
        );
    }
}
