/**
 * Alpha Vantage Market Data Provider
 * Fetches real stock/ETF data from Alpha Vantage (free tier: 25 requests/day,
 * 5/minute). Server-side only -- ALPHA_VANTAGE_API_KEY must never be exposed
 * to the client. Callers should wrap this in src/lib/markets/dataCache.ts so
 * the rate limit is respected; this class does no caching of its own.
 */

import { BaseMarketDataProvider } from './base';
import { OHLCV, FundamentalData, AssetType } from '../types';
import { classifyTicker } from '../tickerClassification';

const BASE_URL = 'https://www.alphavantage.co/query';

function getApiKey(): string {
    const key = process.env.ALPHA_VANTAGE_API_KEY?.trim();
    if (!key) {
        throw new Error('ALPHA_VANTAGE_API_KEY is not configured');
    }
    return key;
}

type AlphaVantageResponse = Record<string, unknown>;

// Alpha Vantage's free tier also enforces a "1 request per second" burst
// limit on top of the daily quota. Requests can come from multiple call
// sites (the analyze route fetches quote+candles+fundamentals, the cron
// fetches quote+candles per ticker), so the pacing lives here -- the one
// place all real Alpha Vantage calls funnel through -- rather than in each
// caller.
let lastCallAt = 0;
const MIN_CALL_SPACING_MS = 1100;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAlphaVantage(params: Record<string, string>): Promise<AlphaVantageResponse> {
    // Reserve this call's slot synchronously (before the `await`) so that
    // concurrent callers (e.g. Promise.all-ed quote + candles fetches) queue
    // up one after another instead of racing on the same stale timestamp.
    const now = Date.now();
    const waitMs = Math.max(0, MIN_CALL_SPACING_MS - (now - lastCallAt));
    lastCallAt = now + waitMs;
    if (waitMs > 0) {
        await sleep(waitMs);
    }

    const url = new URL(BASE_URL);
    url.searchParams.set('apikey', getApiKey());
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Alpha Vantage HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Alpha Vantage returns 200 OK with an error payload instead of an HTTP error
    if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }
    if (data['Note']) {
        throw new Error(`Alpha Vantage rate limit: ${data['Note']}`);
    }
    if (data['Information']) {
        throw new Error(`Alpha Vantage: ${data['Information']}`);
    }

    return data;
}

export class AlphaVantageProvider extends BaseMarketDataProvider {
    async getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }> {
        const data = await callAlphaVantage({ function: 'GLOBAL_QUOTE', symbol: ticker });
        const quote = data['Global Quote'] as Record<string, string> | undefined;

        if (!quote || !quote['05. price']) {
            throw new Error(`Alpha Vantage returned no quote data for ${ticker}`);
        }

        const price = parseFloat(quote['05. price']);
        const change24h = quote['09. change'] !== undefined ? parseFloat(quote['09. change']) : undefined;
        const changePercentRaw = quote['10. change percent'];
        const changePercent24h = changePercentRaw ? parseFloat(changePercentRaw.replace('%', '')) : undefined;

        return { price, change24h, changePercent24h };
    }

    async getCandles(ticker: string, timeframe: string, limit: number = 100): Promise<OHLCV[]> {
        const isWeekly = timeframe === '1W';
        const params: Record<string, string> = {
            function: isWeekly ? 'TIME_SERIES_WEEKLY' : 'TIME_SERIES_DAILY',
            symbol: ticker,
        };
        if (!isWeekly) {
            params.outputsize = 'compact';
        }
        const data = await callAlphaVantage(params);

        const seriesKey = isWeekly ? 'Weekly Time Series' : 'Time Series (Daily)';
        const series = data[seriesKey] as Record<string, Record<string, string>> | undefined;

        if (!series) {
            throw new Error(`Alpha Vantage returned no candle data for ${ticker}`);
        }

        const candles: OHLCV[] = Object.entries(series)
            .map(([date, bar]) => ({
                timestamp: new Date(date).getTime(),
                open: parseFloat(bar['1. open']),
                high: parseFloat(bar['2. high']),
                low: parseFloat(bar['3. low']),
                close: parseFloat(bar['4. close']),
                volume: parseFloat(bar['5. volume']),
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        return candles.slice(-limit);
    }

    async detectAssetType(ticker: string): Promise<AssetType> {
        return classifyTicker(ticker);
    }

    async getFundamentals(ticker: string): Promise<FundamentalData | null> {
        const assetType = classifyTicker(ticker);
        if (assetType === 'crypto') {
            return null;
        }

        const data = await callAlphaVantage({ function: 'OVERVIEW', symbol: ticker });

        if (!data || !data['Symbol']) {
            // ETFs and some tickers return an empty object from OVERVIEW.
            // Return an empty (not null) object so the cache layer can still
            // store this result and avoid re-querying it every time.
            return {};
        }

        const pe = parseFloatOrUndefined(data['PERatio'] as string | undefined);
        const marketCap = parseFloatOrUndefined(data['MarketCapitalization'] as string | undefined);
        const revenue = parseFloatOrUndefined(data['RevenueTTM'] as string | undefined);
        // AV doesn't expose total net income directly; derive it from
        // marketCap / PE (== price*shares / (price/EPS) == shares*EPS).
        const earnings = marketCap && pe ? marketCap / pe : undefined;

        return {
            pe,
            ps: parseFloatOrUndefined(data['PriceToSalesRatioTTM'] as string | undefined),
            marketCap,
            revenue,
            revenueGrowth: parseFloatOrUndefined(data['QuarterlyRevenueGrowthYOY'] as string | undefined, 100),
            earnings,
            earningsGrowth: parseFloatOrUndefined(data['QuarterlyEarningsGrowthYOY'] as string | undefined, 100),
        };
    }
}

function parseFloatOrUndefined(value: string | undefined, scaleToPercent?: number): number | undefined {
    if (value === undefined || value === null || value === 'None' || value === '-') {
        return undefined;
    }
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
        return undefined;
    }
    return scaleToPercent ? parsed * scaleToPercent : parsed;
}
