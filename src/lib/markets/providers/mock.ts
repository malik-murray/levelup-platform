/**
 * Mock Market Data Provider
 * Generates realistic mock data for development/testing
 * Can be swapped with real providers (Polygon, Alpha Vantage, etc.) later
 */

import { BaseMarketDataProvider } from './base';
import { OHLCV, FundamentalData, AssetType } from '../types';

// Module-level price state (persists across provider instances)
const priceState: Map<string, { price: number; timestamp: number }> = new Map();

export class MockMarketDataProvider extends BaseMarketDataProvider {
    /**
     * Get a simulated price that changes over time (for mock data)
     * Uses time-based deterministic variation so it's consistent but changes
     */
    private getSimulatedPrice(ticker: string, basePrice: number): number {
        const upperTicker = ticker.toUpperCase();
        const now = Date.now();
        
        // Use time-based seed for deterministic but changing price
        // This makes the price change every 15 seconds (matching our refresh interval)
        const timeWindow = Math.floor(now / 15000); // Changes every 15 seconds
        
        // Create a seed from ticker and time window
        const tickerSeed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const seed = (timeWindow * 1000 + tickerSeed) % 10000;
        
        // Generate a price variation based on seed (deterministic but changes over time)
        // Creates a sine wave pattern that cycles over time
        const cyclePosition = (timeWindow % 100) / 100; // Cycles every 25 minutes (100 * 15s)
        const sineWave = Math.sin(cyclePosition * Math.PI * 2);
        const randomComponent = (seed % 1000) / 1000; // 0-1
        
        // Combine sine wave (smooth trend) with random component (volatility)
        // Make changes more visible: ±1% trend + ±0.5% volatility per update
        const variationPercent = (sineWave * 0.01) + ((randomComponent - 0.5) * 0.005); // ±1% trend + ±0.5% volatility
        
        // Calculate new price
        let newPrice = basePrice * (1 + variationPercent);
        
        // Add more visible random noise for realism
        const noise = (Math.random() - 0.5) * basePrice * 0.005; // ±0.5% additional noise
        newPrice = newPrice + noise;
        
        // Keep price within reasonable bounds (±2% of base price for more visible movement)
        const minPrice = basePrice * 0.98;
        const maxPrice = basePrice * 1.02;
        newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));
        
        // Store for reference (optional, mainly for debugging)
        priceState.set(upperTicker, { price: newPrice, timestamp: now });
        
        return newPrice;
    }
    
    /**
     * Generate mock OHLCV candles
     */
    private generateCandles(
        basePrice: number,
        timeframe: string,
        count: number,
        trend: 'up' | 'down' | 'sideways' = 'up'
    ): OHLCV[] {
        const candles: OHLCV[] = [];
        const now = Date.now();
        
        // Determine milliseconds per candle based on timeframe
        const msPerCandle: Record<string, number> = {
            '1H': 60 * 60 * 1000,
            '4H': 4 * 60 * 60 * 1000,
            '1D': 24 * 60 * 60 * 1000,
            '1W': 7 * 24 * 60 * 60 * 1000,
            '1M': 30 * 24 * 60 * 60 * 1000,
        };
        
        const interval = msPerCandle[timeframe] || msPerCandle['1D'];
        let price = basePrice;
        
        for (let i = count - 1; i >= 0; i--) {
            const timestamp = now - (i * interval);
            
            // Determine price movement based on trend
            let change = 0;
            if (trend === 'up') {
                change = (Math.random() - 0.3) * basePrice * 0.02; // Slight upward bias
            } else if (trend === 'down') {
                change = (Math.random() - 0.7) * basePrice * 0.02; // Slight downward bias
            } else {
                change = (Math.random() - 0.5) * basePrice * 0.015; // Sideways
            }
            
            price = Math.max(0.01, price + change);
            
            const volatility = basePrice * 0.01 * Math.random();
            const open = price;
            const close = price + (Math.random() - 0.5) * volatility * 2;
            const high = Math.max(open, close) + Math.random() * volatility;
            const low = Math.min(open, close) - Math.random() * volatility;
            const volume = 1000000 + Math.random() * 5000000;
            
            candles.push({
                timestamp,
                open,
                high,
                low,
                close,
                volume,
            });
            
            price = close;
        }
        
        return candles;
    }
    
    async getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }> {
        // Mock prices based on ticker
        const mockPrices: Record<string, number> = {
            'AAPL': 180.50,
            'GOOGL': 140.20,
            'MSFT': 380.75,
            'TSLA': 250.30,
            'BTC': 43250.00,
            'ETH': 3197.47, // Updated ETH price (Dec 2024)
            'ETH-USD': 3197.47, // Support ETH-USD format
            'SPY': 485.20,
            'QQQ': 420.10,
        };
        
        const upperTicker = ticker.toUpperCase();
        let basePrice = mockPrices[upperTicker] || 100 + Math.random() * 200;
        
        // Special handling for ETH - use consistent base price but allow simulation
        if (upperTicker === 'ETH' || upperTicker === 'ETH-USD') {
            basePrice = 3197.47;
        }
        
        // Get simulated price that changes over time
        const currentPrice = this.getSimulatedPrice(ticker, basePrice);
        
        // Calculate 24h change (simulate a realistic 24h movement)
        const changePercent = (Math.random() - 0.45) * 6; // Slight upward bias, -2.7% to +3.3%
        const change24h = basePrice * (changePercent / 100);
        
        return {
            price: currentPrice,
            change24h: change24h,
            changePercent24h: changePercent,
        };
    }
    
    async getCandles(ticker: string, timeframe: string, limit: number = 100): Promise<OHLCV[]> {
        const upperTicker = ticker.toUpperCase();
        
        // Special handling for ETH-USD with realistic data
        if (upperTicker === 'ETH' || upperTicker === 'ETH-USD') {
            return this.generateEthCandles(timeframe, limit);
        }
        
        const { price } = await this.getCurrentPrice(ticker);
        
        // Determine trend based on ticker (mock behavior)
        const trendSeed = ticker.charCodeAt(0) % 3;
        const trends: Array<'up' | 'down' | 'sideways'> = ['up', 'down', 'sideways'];
        const trend = trends[trendSeed];
        
        return this.generateCandles(price, timeframe, limit, trend);
    }
    
    /**
     * Generate realistic ETH-USD candles with trend segments and volume patterns
     */
    private generateEthCandles(timeframe: string, limit: number): OHLCV[] {
        const candles: OHLCV[] = [];
        const now = Date.now();
        
        // Determine milliseconds per candle based on timeframe
        const msPerCandle: Record<string, number> = {
            '1H': 60 * 60 * 1000,
            '4H': 4 * 60 * 60 * 1000,
            '1D': 24 * 60 * 60 * 1000,
            '1W': 7 * 24 * 60 * 60 * 1000,
            '1M': 30 * 24 * 60 * 60 * 1000,
        };
        
        const interval = msPerCandle[timeframe] || msPerCandle['1D'];
        
        // ETH price range: $2200-$3200 (realistic range)
        let currentPrice = 3197.47; // Updated ETH price (Dec 2024)
        const basePrice = currentPrice;
        
        // Define trend segments for realistic price action
        // Format: [startIndex, endIndex, trendType, strength]
        const trendSegments: Array<[number, number, 'up' | 'down' | 'sideways', number]> = [
            [0, 20, 'down', 0.8],    // Initial downtrend (strong)
            [20, 35, 'sideways', 0.5], // Consolidation
            [35, 55, 'up', 1.0],      // Strong uptrend
            [55, 70, 'down', 0.6],    // Pullback
            [70, 85, 'up', 0.8],      // Recovery
            [85, 100, 'sideways', 0.4], // Final consolidation
        ];
        
        // Average volume for ETH (in USD)
        const baseVolume4H = 150_000_000; // $150M per 4H
        const baseVolumeDaily = 800_000_000; // $800M per day
        const baseVolume = timeframe === '4H' ? baseVolume4H : baseVolumeDaily;
        
        for (let i = limit - 1; i >= 0; i--) {
            const timestamp = now - (i * interval);
            
            // Determine which trend segment we're in
            let trend: 'up' | 'down' | 'sideways' = 'sideways';
            let strength = 0.5;
            
            for (const [start, end, trendType, trendStrength] of trendSegments) {
                if (i >= start && i < end) {
                    trend = trendType;
                    strength = trendStrength;
                    break;
                }
            }
            
            // Calculate price movement based on trend and strength
            let priceChange = 0;
            const volatility = basePrice * 0.015 * strength; // 1.5% volatility
            
            if (trend === 'up') {
                // Upward movement with some noise
                priceChange = (Math.random() * 0.7 + 0.3) * volatility * strength;
            } else if (trend === 'down') {
                // Downward movement with some noise
                priceChange = -(Math.random() * 0.7 + 0.3) * volatility * strength;
            } else {
                // Sideways with small random moves
                priceChange = (Math.random() - 0.5) * volatility * 0.5;
            }
            
            // Apply price change
            currentPrice = Math.max(2200, Math.min(3200, currentPrice + priceChange));
            
            // Generate OHLC with realistic patterns
            const intradayVolatility = currentPrice * 0.008 * (0.8 + Math.random() * 0.4);
            
            // Open is close from previous candle (or start price)
            const open = i === limit - 1 ? currentPrice : candles[candles.length - 1].close;
            
            // Close varies from open based on trend
            let closeBias = 0;
            if (trend === 'up') closeBias = intradayVolatility * (0.3 + Math.random() * 0.4);
            if (trend === 'down') closeBias = -intradayVolatility * (0.3 + Math.random() * 0.4);
            
            const close = open + closeBias + (Math.random() - 0.5) * intradayVolatility * 0.4;
            
            // High and low with realistic wicks
            const bodyHigh = Math.max(open, close);
            const bodyLow = Math.min(open, close);
            const wickSize = intradayVolatility * (0.5 + Math.random() * 0.5);
            
            const high = bodyHigh + Math.random() * wickSize;
            const low = bodyLow - Math.random() * wickSize;
            
            // Volume with realistic patterns
            // Higher volume during trends, lower during consolidation
            let volumeMultiplier = 1.0;
            if (trend === 'sideways') {
                volumeMultiplier = 0.7 + Math.random() * 0.3; // Lower volume
            } else {
                volumeMultiplier = 0.9 + Math.random() * 0.6; // Higher volume
            }
            
            // Add some randomness and spikes
            if (Math.random() < 0.1) {
                volumeMultiplier *= 2.5; // Volume spike 10% of the time
            }
            
            const volume = baseVolume * volumeMultiplier * (0.8 + Math.random() * 0.4);
            
            candles.push({
                timestamp,
                open,
                high,
                low,
                close,
                volume,
            });
            
            // Update currentPrice for next iteration
            currentPrice = close;
        }
        
        return candles;
    }
    
    async detectAssetType(ticker: string): Promise<AssetType> {
        const upper = ticker.toUpperCase();
        
        // Common crypto tickers (including ETH-USD format)
        if (['BTC', 'ETH', 'ETH-USD', 'BNB', 'ADA', 'SOL', 'DOT', 'DOGE', 'MATIC', 'AVAX', 'LINK'].includes(upper)) {
            return 'crypto';
        }
        
        // Common ETFs
        if (['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO'].includes(upper)) {
            return 'etf';
        }
        
        // Default to stock
        return 'stock';
    }
    
    async getFundamentals(ticker: string): Promise<FundamentalData | null> {
        const assetType = await this.detectAssetType(ticker);
        
        // Only stocks and ETFs have fundamentals
        if (assetType === 'crypto') {
            return null;
        }
        
        // Mock fundamental data
        return {
            pe: 15 + Math.random() * 25, // 15-40
            ps: 2 + Math.random() * 8, // 2-10
            marketCap: (10 + Math.random() * 990) * 1_000_000_000, // $10B - $1T
            revenue: (1 + Math.random() * 99) * 1_000_000_000, // $1B - $100B
            revenueGrowth: (Math.random() - 0.3) * 30, // -9% to +21%
            earnings: (0.1 + Math.random() * 9.9) * 1_000_000_000, // $100M - $10B
            earningsGrowth: (Math.random() - 0.4) * 40, // -16% to +24%
        };
    }
}

