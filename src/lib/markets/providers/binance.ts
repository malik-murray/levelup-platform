/**
 * Binance Crypto Market Data Provider
 * Fetches real crypto market data from Binance Public API (free, no auth required)
 * Supports ETH and other crypto pairs
 */

import { BaseMarketDataProvider } from './base';
import { OHLCV, FundamentalData, AssetType } from '../types';

export class BinanceCryptoProvider extends BaseMarketDataProvider {
    private baseUrl = 'https://api.binance.com/api/v3';
    
    /**
     * Map our timeframe format to Binance interval format
     */
    private mapTimeframe(timeframe: string): string {
        const mapping: Record<string, string> = {
            '1H': '1h',
            '4H': '4h',
            '1D': '1d',
            '1W': '1w',
            '1M': '1M',
        };
        return mapping[timeframe] || '1d';
    }
    
    /**
     * Convert ticker to Binance symbol format
     */
    private toBinanceSymbol(ticker: string): string | null {
        const upper = ticker.toUpperCase();
        
        // Handle ETH formats
        if (upper === 'ETH' || upper === 'ETH-USD') {
            return 'ETHUSDT';
        }
        
        // Handle other common crypto formats
        if (upper === 'BTC' || upper === 'BTC-USD') {
            return 'BTCUSDT';
        }
        
        // If already in Binance format (e.g., ETHUSDT), use as-is
        if (upper.endsWith('USDT')) {
            return upper;
        }
        
        return null;
    }
    
    async getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }> {
        const symbol = this.toBinanceSymbol(ticker);
        if (!symbol) {
            throw new Error(`Unsupported ticker for Binance: ${ticker}`);
        }
        
        try {
            // First try the 24hr ticker endpoint for complete data (price + 24h change)
            try {
                const response = await fetch(`${this.baseUrl}/ticker/24hr?symbol=${symbol}`);
                
                if (!response.ok) {
                    throw new Error(`Binance 24hr ticker error: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Check if we got an error response from Binance
                if (data.code && data.code !== 0) {
                    throw new Error(`Binance API error: ${data.msg || 'Unknown error'}`);
                }
                
                return {
                    price: parseFloat(data.lastPrice),
                    change24h: parseFloat(data.priceChange),
                    changePercent24h: parseFloat(data.priceChangePercent),
                };
            } catch (error: any) {
                // If 24hr ticker fails, try the simpler price endpoint as fallback
                console.warn(`24hr ticker failed for ${symbol}, trying price endpoint:`, error);
                
                const priceResponse = await fetch(`${this.baseUrl}/ticker/price?symbol=${symbol}`);
                
                if (!priceResponse.ok) {
                    throw new Error(`Binance price endpoint error: ${priceResponse.status} ${priceResponse.statusText}`);
                }
                
                const priceData = await priceResponse.json();
                
                if (priceData.code && priceData.code !== 0) {
                    throw new Error(`Binance API error: ${priceData.msg || 'Unknown error'}`);
                }
                
                // Simple price endpoint doesn't have 24h change, so we return just the price
                return {
                    price: parseFloat(priceData.price),
                    change24h: undefined,
                    changePercent24h: undefined,
                };
            }
        } catch (error: any) {
            console.error(`Error fetching price from Binance for ${ticker}:`, error);
            
            // Provide more helpful error message
            if (error.message?.includes('restricted location')) {
                throw new Error(`Binance API is restricted in your location. Please use mock data or a different provider.`);
            }
            
            throw error;
        }
    }
    
    async getCandles(ticker: string, timeframe: string, limit: number = 100): Promise<OHLCV[]> {
        const symbol = this.toBinanceSymbol(ticker);
        if (!symbol) {
            throw new Error(`Unsupported ticker for Binance: ${ticker}`);
        }
        
        const interval = this.mapTimeframe(timeframe);
        
        try {
            // Binance API: GET /api/v3/klines
            // Parameters: symbol, interval, limit, startTime (optional), endTime (optional)
            const response = await fetch(
                `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
            
            if (!response.ok) {
                throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Binance klines format: [openTime, open, high, low, close, volume, ...]
            // We need to convert to OHLCV format
            const candles: OHLCV[] = data.map((kline: any[]) => ({
                timestamp: kline[0], // Open time in milliseconds
                open: parseFloat(kline[1]),
                high: parseFloat(kline[2]),
                low: parseFloat(kline[3]),
                close: parseFloat(kline[4]),
                volume: parseFloat(kline[5]), // Quote asset volume (USDT)
            }));
            
            return candles;
        } catch (error) {
            console.error(`Error fetching candles from Binance for ${ticker}:`, error);
            throw error;
        }
    }
    
    async detectAssetType(ticker: string): Promise<AssetType> {
        // This provider only handles crypto
        const symbol = this.toBinanceSymbol(ticker);
        return symbol ? 'crypto' : 'stock'; // Default fallback
    }
    
    async getFundamentals(ticker: string): Promise<FundamentalData | null> {
        // Crypto doesn't have traditional fundamentals
        return null;
    }
}

