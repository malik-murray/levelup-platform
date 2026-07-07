/**
 * Rate-limit-aware cache for real market data providers (server-only).
 * Alpha Vantage's free tier is 25 requests/day, 5/minute -- this wrapper
 * caches responses in market_data_cache and tracks daily call counts in
 * market_api_usage so no single provider blows the budget. Mirrors the
 * staleness-guard pattern in src/lib/newsfeed/runIngestionIfStale.ts.
 */

import { getServiceRoleSupabase } from '@/lib/auth/getAuthenticatedUser';
import { AssetType } from './types';

export type CacheDataType = 'quote' | 'candles' | 'fundamentals';
export type CacheSource = 'alpha_vantage' | 'binance' | 'mock';

export type CachedResult<T> = {
    payload: T;
    stale: boolean;
    source: CacheSource;
    fetchedAt: string;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function ttlMsFor(dataType: CacheDataType, timeframe: string): number {
    if (dataType === 'quote') return 6 * HOUR_MS;
    if (dataType === 'fundamentals') return 7 * DAY_MS;
    // candles
    return timeframe === '1W' ? 3 * DAY_MS : 20 * HOUR_MS;
}

export function getDailyBudget(): number {
    const parsed = Number(process.env.MARKET_DATA_DAILY_BUDGET || '20');
    if (!Number.isFinite(parsed) || parsed <= 0) return 20;
    return Math.floor(parsed);
}

function todayDateString(): string {
    return new Date().toISOString().slice(0, 10);
}

async function getUsageToday(db: ReturnType<typeof getServiceRoleSupabase>, provider: string): Promise<number> {
    const { data } = await db
        .from('market_api_usage')
        .select('call_count')
        .eq('provider', provider)
        .eq('usage_date', todayDateString())
        .maybeSingle();

    return data?.call_count ?? 0;
}

async function incrementUsage(db: ReturnType<typeof getServiceRoleSupabase>, provider: string): Promise<void> {
    const usageDate = todayDateString();
    const current = await getUsageToday(db, provider);

    const { error } = await db
        .from('market_api_usage')
        .upsert(
            { provider, usage_date: usageDate, call_count: current + 1 },
            { onConflict: 'provider,usage_date' }
        );

    if (error) {
        console.error(`[market-data-cache] failed to record API usage for ${provider}: ${error.message}`);
    }
}

/**
 * Read-through cache: returns fresh data if within TTL, otherwise calls
 * fetchFn if the daily budget allows, otherwise falls back to a stale cache
 * entry (better than nothing). Throws only if there is no cache at all and
 * either the fetch failed or the budget is exhausted.
 */
export async function getCachedOrFetch<T>(options: {
    ticker: string;
    assetType: AssetType;
    dataType: CacheDataType;
    timeframe?: string;
    provider: 'alpha_vantage';
    fetchFn: () => Promise<T>;
}): Promise<CachedResult<T>> {
    const { ticker, assetType, dataType, provider, fetchFn } = options;
    const timeframe = options.timeframe ?? '';
    const upperTicker = ticker.toUpperCase();
    const db = getServiceRoleSupabase();

    const { data: cached } = await db
        .from('market_data_cache')
        .select('*')
        .eq('ticker', upperTicker)
        .eq('data_type', dataType)
        .eq('timeframe', timeframe)
        .maybeSingle();

    const ttl = ttlMsFor(dataType, timeframe);
    const isFresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < ttl;

    if (cached && isFresh) {
        return { payload: cached.payload as T, stale: false, source: cached.source, fetchedAt: cached.fetched_at };
    }

    const used = await getUsageToday(db, provider);
    const budgetAvailable = used < getDailyBudget();

    if (budgetAvailable) {
        try {
            const fresh = await fetchFn();
            const fetchedAt = new Date().toISOString();

            // The external call already happened -- count it against the
            // daily budget regardless of whether caching it below succeeds.
            await incrementUsage(db, provider);

            const { error: upsertError } = await db.from('market_data_cache').upsert(
                {
                    ticker: upperTicker,
                    asset_type: assetType,
                    data_type: dataType,
                    timeframe,
                    payload: fresh as unknown,
                    source: provider,
                    fetched_at: fetchedAt,
                },
                { onConflict: 'ticker,data_type,timeframe' }
            );
            if (upsertError) {
                console.error(
                    `[market-data-cache] failed to persist cache for ${upperTicker} (${dataType}/${timeframe}): ${upsertError.message}`
                );
            }

            return { payload: fresh, stale: false, source: provider, fetchedAt };
        } catch (error) {
            console.warn(`[market-data-cache] fetch failed for ${upperTicker} (${dataType}/${timeframe}):`, error);
            if (cached) {
                return { payload: cached.payload as T, stale: true, source: cached.source, fetchedAt: cached.fetched_at };
            }
            throw error;
        }
    }

    if (cached) {
        return { payload: cached.payload as T, stale: true, source: cached.source, fetchedAt: cached.fetched_at };
    }

    throw new Error(
        `Alpha Vantage daily budget (${getDailyBudget()}) exhausted and no cached data available for ${upperTicker}`
    );
}

/**
 * Read-only cache lookup that never calls the external provider or spends
 * budget -- used by the /api/markets/quote endpoint, which is polled
 * frequently and must stay cheap. The cron job is what keeps this fresh.
 */
export async function peekCache<T>(
    ticker: string,
    dataType: CacheDataType,
    timeframe?: string
): Promise<CachedResult<T> | null> {
    const db = getServiceRoleSupabase();
    const upperTicker = ticker.toUpperCase();
    const tf = timeframe ?? '';

    const { data: cached } = await db
        .from('market_data_cache')
        .select('*')
        .eq('ticker', upperTicker)
        .eq('data_type', dataType)
        .eq('timeframe', tf)
        .maybeSingle();

    if (!cached) return null;

    const ttl = ttlMsFor(dataType, tf);
    const stale = Date.now() - new Date(cached.fetched_at).getTime() >= ttl;

    return { payload: cached.payload as T, stale, source: cached.source, fetchedAt: cached.fetched_at };
}
