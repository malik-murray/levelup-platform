import type { SupabaseClient } from '@supabase/supabase-js';

export type HealthIngestSample = {
    metric_type: 'steps' | 'sleep_hours' | 'weight_kg' | 'heart_rate' | 'resting_hr' | 'hrv';
    value: number;
    date?: string;
    recorded_at?: string;
    source_id: string;
    unit?: string;
};

export type HealthIngestPayload = {
    provider: 'health_connect' | 'apple_health' | 'google_health' | 'other';
    samples: HealthIngestSample[];
};

function todayDateString(): string {
    return new Date().toISOString().split('T')[0];
}

async function upsertDailyMetrics(
    supabase: SupabaseClient,
    userId: string,
    date: string,
    patch: Record<string, string | number | null>
): Promise<void> {
    const { data: existing } = await supabase
        .from('fitness_metrics')
        .select('id, weight_kg, steps, water_ml, sleep_hours, steps_source, sleep_source, weight_source')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

    const payload = {
        user_id: userId,
        date,
        weight_kg: patch.weight_kg ?? existing?.weight_kg ?? null,
        steps: patch.steps ?? existing?.steps ?? null,
        water_ml: existing?.water_ml ?? null,
        sleep_hours: patch.sleep_hours ?? existing?.sleep_hours ?? null,
        steps_source: patch.steps_source ?? existing?.steps_source ?? null,
        sleep_source: patch.sleep_source ?? existing?.sleep_source ?? null,
        weight_source: patch.weight_source ?? existing?.weight_source ?? null,
        updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
        const { error } = await supabase.from('fitness_metrics').update(payload).eq('id', existing.id);
        if (error) throw new Error(error.message);
        return;
    }

    const { error } = await supabase.from('fitness_metrics').insert(payload);
    if (error) throw new Error(error.message);
}

export async function ingestHealthSamples(
    supabase: SupabaseClient,
    userId: string,
    payload: HealthIngestPayload
): Promise<{ metrics_updated: number; vitals_updated: number }> {
    let metricsUpdated = 0;
    let vitalsUpdated = 0;

    for (const sample of payload.samples) {
        const date = sample.date ?? sample.recorded_at?.split('T')[0] ?? todayDateString();

        if (sample.metric_type === 'steps') {
            await upsertDailyMetrics(supabase, userId, date, {
                steps: Math.round(sample.value),
                steps_source: payload.provider,
            });
            metricsUpdated += 1;
            continue;
        }

        if (sample.metric_type === 'sleep_hours') {
            await upsertDailyMetrics(supabase, userId, date, {
                sleep_hours: Number(sample.value.toFixed(2)),
                sleep_source: payload.provider,
            });
            metricsUpdated += 1;
            continue;
        }

        if (sample.metric_type === 'weight_kg') {
            await upsertDailyMetrics(supabase, userId, date, {
                weight_kg: Number(sample.value.toFixed(2)),
                weight_source: payload.provider,
            });
            metricsUpdated += 1;
            continue;
        }

        if (sample.metric_type === 'heart_rate' || sample.metric_type === 'resting_hr' || sample.metric_type === 'hrv') {
            const recordedAt = sample.recorded_at ?? `${date}T12:00:00.000Z`;
            const unit = sample.unit ?? (sample.metric_type === 'hrv' ? 'ms' : 'bpm');

            const { error } = await supabase.from('fitness_vital_samples').upsert(
                {
                    user_id: userId,
                    provider: payload.provider,
                    source_id: sample.source_id,
                    metric_type: sample.metric_type,
                    value: sample.value,
                    unit,
                    recorded_at: recordedAt,
                },
                { onConflict: 'user_id,provider,source_id' }
            );

            if (error) throw new Error(error.message);
            vitalsUpdated += 1;
        }
    }

    const providerIntegration = payload.provider === 'google_health' ? 'other' : payload.provider;
    const now = new Date().toISOString();

    const { data: existingIntegration } = await supabase
        .from('fitness_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', providerIntegration)
        .maybeSingle();

    if (existingIntegration?.id) {
        await supabase
            .from('fitness_integrations')
            .update({ status: 'connected', last_synced_at: now, updated_at: now })
            .eq('id', existingIntegration.id);
    } else if (providerIntegration !== 'other') {
        await supabase.from('fitness_integrations').insert({
            user_id: userId,
            provider: providerIntegration,
            status: 'connected',
            last_synced_at: now,
        });
    }

    return { metrics_updated: metricsUpdated, vitals_updated: vitalsUpdated };
}
