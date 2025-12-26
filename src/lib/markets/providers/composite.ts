/**
 * Composite Market Data Provider
 * Routes requests to appropriate provider based on ticker and configuration
 * Uses real data for ETH-USD (if enabled) and mock for everything else
 */

import { MarketDataProvider } from '../types';
import { MockMarketDataProvider } from './mock';
import { BinanceCryptoProvider } from './binance';
import { OHLCV, FundamentalData, AssetType } from '../types';

export class CompositeMarketDataProvider implements MarketDataProvider {
    private mockProvider: MockMarketDataProvider;
    private binanceProvider: BinanceCryptoProvider;
    private useRealDataForEth: boolean;
    
    constructor(useRealDataForEth: boolean = false) {
        this.mockProvider = new MockMarketDataProvider();
        this.binanceProvider = new BinanceCryptoProvider();
        this.useRealDataForEth = useRealDataForEth;
    }
    
    /**
     * Check if ticker should use real data
     */
    private shouldUseRealData(ticker: string): boolean {
        if (!this.useRealDataForEth) {
            return false;
        }
        
        const upper = ticker.toUpperCase();
        return upper === 'ETH' || upper === 'ETH-USD';
    }
    
    async getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }> {
        if (this.shouldUseRealData(ticker)) {
            try {
                return await this.binanceProvider.getCurrentPrice(ticker);
            } catch (error) {
                console.warn(`Failed to fetch real data for ${ticker}, falling back to mock:`, error);
                return await this.mockProvider.getCurrentPrice(ticker);
            }
        }
        
        return await this.mockProvider.getCurrentPrice(ticker);
    }
    
    async getCandles(ticker: string, timeframe: string, limit?: number): Promise<OHLCV[]> {
        if (this.shouldUseRealData(ticker)) {
            try {
                return await this.binanceProvider.getCandles(ticker, timeframe, limit);
            } catch (error) {
                console.warn(`Failed to fetch real candles for ${ticker}, falling back to mock:`, error);
                return await this.mockProvider.getCandles(ticker, timeframe, limit);
            }
        }
        
        return await this.mockProvider.getCandles(ticker, timeframe, limit);
    }
    
    async detectAssetType(ticker: string): Promise<AssetType> {
        // Use mock provider for detection (it handles all asset types)
        // Real provider only knows about crypto
        return await this.mockProvider.detectAssetType(ticker);
    }
    
    async getFundamentals(ticker: string): Promise<FundamentalData | null> {
        // Use mock provider for fundamentals (crypto doesn't have fundamentals anyway)
        return await this.mockProvider.getFundamentals(ticker);
    }
}

/**
 * Create a market data provider based on environment configuration
 */
export function createMarketDataProvider(): MarketDataProvider {
    // Check environment variable or default to false (use mock)
    const useRealEthData = process.env.NEXT_PUBLIC_USE_REAL_ETH_DATA === 'true';
    
    return new CompositeMarketDataProvider(useRealEthData);
}








