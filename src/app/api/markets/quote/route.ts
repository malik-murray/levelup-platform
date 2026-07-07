import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { BinanceCryptoProvider } from '@/lib/markets/providers/binance';
import { MockMarketDataProvider } from '@/lib/markets/providers/mock';
import { classifyTicker } from '@/lib/markets/tickerClassification';
import { peekCache } from '@/lib/markets/dataCache';

const binance = new BinanceCryptoProvider();
const mock = new MockMarketDataProvider();

/**
 * GET /api/markets/quote?ticker=AAPL
 *
 * Lightweight price lookup meant to be polled often. Crypto always goes
 * live to Binance (no meaningful rate limit). Stocks/ETFs are cache-only --
 * this route never calls Alpha Vantage itself; the market-data-refresh cron
 * keeps the cache warm. Returns `stale: true` when the cached quote is older
 * than its TTL so the UI can show a "last updated" hint.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker')?.trim().toUpperCase();
        if (!ticker) {
            return NextResponse.json({ error: 'ticker query param is required' }, { status: 400 });
        }

        const assetType = classifyTicker(ticker);

        if (assetType === 'crypto') {
            try {
                const price = await binance.getCurrentPrice(ticker);
                return NextResponse.json({ ...price, stale: false, source: 'binance', lastUpdated: new Date().toISOString() });
            } catch (error) {
                console.warn(`[markets/quote] Binance failed for ${ticker}, falling back to mock:`, error);
                const price = await mock.getCurrentPrice(ticker);
                return NextResponse.json({ ...price, stale: true, source: 'mock', lastUpdated: new Date().toISOString() });
            }
        }

        const cached = await peekCache<{ price: number; change24h?: number; changePercent24h?: number }>(ticker, 'quote');
        if (!cached) {
            return NextResponse.json(
                { error: `No cached quote for ${ticker} yet -- it will be picked up on the next market-data-refresh run.` },
                { status: 404 }
            );
        }

        return NextResponse.json({ ...cached.payload, stale: cached.stale, source: cached.source, lastUpdated: cached.fetchedAt });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch quote';
        console.error('[markets/quote]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
