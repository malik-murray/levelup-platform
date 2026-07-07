/**
 * Server-side Market Data Provider
 * Routes crypto to Binance (live, no rate limit worth worrying about) and
 * stocks/ETFs to Alpha Vantage through the rate-limit-aware cache in
 * dataCache.ts. Falls back to mock data on any failure so the app never
 * hard-crashes on a bad ticker or exhausted quota.
 *
 * IMPORTANT: only import this from server-side code (API routes, cron jobs).
 * It reads ALPHA_VANTAGE_API_KEY and SUPABASE_SERVICE_ROLE_KEY, which must
 * never reach the client bundle.
 */

import { MarketDataProvider, OHLCV, FundamentalData, AssetType } from '../types';
import { BinanceCryptoProvider } from './binance';
import { AlphaVantageProvider } from './alphaVantage';
import { MockMarketDataProvider } from './mock';
import { classifyTicker } from '../tickerClassification';
import { getCachedOrFetch } from '../dataCache';

export class ServerMarketDataProvider implements MarketDataProvider {
    private binance = new BinanceCryptoProvider();
    private alphaVantage = new AlphaVantageProvider();
    private mock = new MockMarketDataProvider();

    async detectAssetType(ticker: string): Promise<AssetType> {
        return classifyTicker(ticker);
    }

    async getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }> {
        const assetType = classifyTicker(ticker);

        if (assetType === 'crypto') {
            try {
                return await this.binance.getCurrentPrice(ticker);
            } catch (error) {
                console.warn(`[markets] Binance price failed for ${ticker}, falling back to mock:`, error);
                return this.mock.getCurrentPrice(ticker);
            }
        }

        try {
            const result = await getCachedOrFetch({
                ticker,
                assetType,
                dataType: 'quote',
                provider: 'alpha_vantage',
                fetchFn: () => this.alphaVantage.getCurrentPrice(ticker),
            });
            return result.payload;
        } catch (error) {
            console.warn(`[markets] Alpha Vantage quote failed for ${ticker}, falling back to mock:`, error);
            return this.mock.getCurrentPrice(ticker);
        }
    }

    async getCandles(ticker: string, timeframe: string, limit: number = 100): Promise<OHLCV[]> {
        const assetType = classifyTicker(ticker);

        if (assetType === 'crypto') {
            try {
                return await this.binance.getCandles(ticker, timeframe, limit);
            } catch (error) {
                console.warn(`[markets] Binance candles failed for ${ticker}, falling back to mock:`, error);
                return this.mock.getCandles(ticker, timeframe, limit);
            }
        }

        try {
            const result = await getCachedOrFetch({
                ticker,
                assetType,
                dataType: 'candles',
                timeframe,
                provider: 'alpha_vantage',
                fetchFn: () => this.alphaVantage.getCandles(ticker, timeframe, limit),
            });
            return result.payload;
        } catch (error) {
            console.warn(`[markets] Alpha Vantage candles failed for ${ticker}, falling back to mock:`, error);
            return this.mock.getCandles(ticker, timeframe, limit);
        }
    }

    async getFundamentals(ticker: string): Promise<FundamentalData | null> {
        const assetType = classifyTicker(ticker);

        if (assetType === 'crypto') {
            return null;
        }

        try {
            const result = await getCachedOrFetch({
                ticker,
                assetType,
                dataType: 'fundamentals',
                provider: 'alpha_vantage',
                fetchFn: () => this.alphaVantage.getFundamentals(ticker),
            });
            return result.payload;
        } catch (error) {
            console.warn(`[markets] Alpha Vantage fundamentals failed for ${ticker}, falling back to mock:`, error);
            return this.mock.getFundamentals(ticker);
        }
    }
}

export function createServerMarketDataProvider(): MarketDataProvider {
    return new ServerMarketDataProvider();
}
