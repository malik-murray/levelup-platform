/**
 * Base Market Data Provider
 * Abstract class that can be extended for different providers
 */

import { MarketDataProvider, OHLCV, FundamentalData, AssetType } from '../types';

export abstract class BaseMarketDataProvider implements MarketDataProvider {
    abstract getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }>;
    abstract getCandles(ticker: string, timeframe: string, limit?: number): Promise<OHLCV[]>;
    abstract detectAssetType(ticker: string): Promise<AssetType>;
    abstract getFundamentals(ticker: string): Promise<FundamentalData | null>;
}







