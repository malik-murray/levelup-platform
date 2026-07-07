import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest, isCronConfigured } from '@/lib/cron/authorizeCronRequest';
import { getServiceRoleSupabase } from '@/lib/auth/getAuthenticatedUser';
import { AlphaVantageProvider } from '@/lib/markets/providers/alphaVantage';
import { getCachedOrFetch, getDailyBudget } from '@/lib/markets/dataCache';
import { classifyTicker } from '@/lib/markets/tickerClassification';
import { AssetType } from '@/lib/markets/types';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const alphaVantage = new AlphaVantageProvider();

/**
 * Distinct stock/ETF tickers across every user's watchlist + positions.
 * Crypto is excluded -- it's served live from Binance and never cached.
 */
async function collectStockEtfTickers(db: ReturnType<typeof getServiceRoleSupabase>): Promise<string[]> {
    const [{ data: watchlist }, { data: positions }] = await Promise.all([
        db.from('market_watchlist').select('ticker'),
        db.from('market_positions').select('ticker'),
    ]);

    const tickers = new Set<string>();
    for (const row of [...(watchlist ?? []), ...(positions ?? [])]) {
        const ticker = (row as { ticker?: string }).ticker?.toUpperCase();
        if (ticker && classifyTicker(ticker) !== 'crypto') {
            tickers.add(ticker);
        }
    }
    return Array.from(tickers);
}

/**
 * Scheduled refresh of Alpha Vantage-backed quote + daily candle data.
 * Vercel: schedule on weekday mornings before market open in vercel.json.
 * getCachedOrFetch() already enforces the daily Alpha Vantage call budget
 * (MARKET_DATA_DAILY_BUDGET), so this loop can just ask for every ticker --
 * once the budget is spent, remaining tickers keep serving stale cache
 * instead of triggering new calls.
 */
export async function GET(request: NextRequest) {
    if (!isCronConfigured()) {
        return NextResponse.json(
            { error: 'CRON_SECRET is not set on the server. Market data refresh will not run in the background.' },
            { status: 503 }
        );
    }

    if (!authorizeCronRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.ALPHA_VANTAGE_API_KEY) {
        return NextResponse.json({ error: 'ALPHA_VANTAGE_API_KEY is not configured' }, { status: 503 });
    }

    try {
        const db = getServiceRoleSupabase();
        const tickers = await collectStockEtfTickers(db);

        const refreshed: string[] = [];
        const staleOnly: string[] = [];
        const failed: { ticker: string; error: string }[] = [];

        for (const ticker of tickers) {
            const assetType: AssetType = classifyTicker(ticker);
            try {
                const [quote, candles] = await Promise.all([
                    getCachedOrFetch({
                        ticker,
                        assetType,
                        dataType: 'quote',
                        provider: 'alpha_vantage',
                        fetchFn: () => alphaVantage.getCurrentPrice(ticker),
                    }),
                    getCachedOrFetch({
                        ticker,
                        assetType,
                        dataType: 'candles',
                        timeframe: '1D',
                        provider: 'alpha_vantage',
                        fetchFn: () => alphaVantage.getCandles(ticker, '1D', 100),
                    }),
                ]);

                if (quote.stale && candles.stale) {
                    // Both served from cache without a fresh call -- likely budget exhausted for today.
                    staleOnly.push(ticker);
                } else {
                    refreshed.push(ticker);
                }
            } catch (error) {
                failed.push({ ticker, error: error instanceof Error ? error.message : String(error) });
            }
        }

        console.info('[market-data-refresh-cron] finished', {
            tickers_considered: tickers.length,
            refreshed: refreshed.length,
            stale_only: staleOnly.length,
            failed: failed.length,
            daily_budget: getDailyBudget(),
            triggered_by: request.headers.get('x-vercel-cron') ? 'vercel' : 'external',
        });

        return NextResponse.json({
            ok: true,
            tickers_considered: tickers.length,
            refreshed,
            stale_only: staleOnly,
            failed,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Market data refresh cron failed';
        console.error('[market-data-refresh-cron]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
