/**
 * Universal Analyzer
 * Main service that orchestrates market data fetching, layer analysis, and signal generation
 */

import { MarketDataProvider } from './types';
import { SignalEngine } from './signalEngine';
import {
    TrendLayer,
    MomentumLayer,
    SupportResistanceLayer,
    VolumeVolatilityLayer,
    FundamentalsLayer,
    UserPositionLayer,
} from './layers';
import {
    AnalysisResult,
    AnalysisMode,
    MarketData,
    FundamentalData,
    UserPosition,
    MarketRegime,
} from './types';
import { getModeConfig } from './modes';
import { SignalLogger, noOpLogger } from './signalLogger';

export class UniversalAnalyzer {
    private dataProvider: MarketDataProvider;
    private signalEngine: SignalEngine;
    
    constructor(dataProvider: MarketDataProvider, logger?: SignalLogger) {
        this.dataProvider = dataProvider;
        
        // Initialize signal engine with all data layers and logger
        this.signalEngine = new SignalEngine([
            new TrendLayer(),
            new MomentumLayer(),
            new SupportResistanceLayer(),
            new VolumeVolatilityLayer(),
            new FundamentalsLayer(),
            new UserPositionLayer(),
        ], logger || noOpLogger);
    }
    
    /**
     * Analyze a ticker with specified mode
     */
    async analyzeTicker(
        ticker: string,
        mode: AnalysisMode,
        userPosition?: UserPosition
    ): Promise<AnalysisResult> {
        // Detect asset type
        const assetType = await this.dataProvider.detectAssetType(ticker);
        
        // Get mode configuration for timeframes
        const modeConfig = getModeConfig(mode);
        
        // Use primary timeframe for analysis
        const primaryTimeframe = modeConfig.timeframes[0];
        
        // Fetch market data
        const [currentPriceData, candles] = await Promise.all([
            this.dataProvider.getCurrentPrice(ticker),
            this.dataProvider.getCandles(ticker, primaryTimeframe, 100),
        ]);
        
        const marketData: MarketData = {
            ticker,
            assetType,
            currentPrice: currentPriceData.price,
            change24h: currentPriceData.change24h,
            changePercent24h: currentPriceData.changePercent24h,
            candles,
            timeframe: primaryTimeframe,
        };
        
        // Fetch fundamentals (stocks/ETFs only)
        let fundamentalData: FundamentalData | null = null;
        if (assetType !== 'crypto') {
            fundamentalData = await this.dataProvider.getFundamentals(ticker);
        }
        
        // Update user position with current price if provided
        let position = userPosition;
        if (position) {
            position = {
                ...position,
                currentPrice: marketData.currentPrice,
                pnl: (marketData.currentPrice - position.averageEntry) * position.quantity,
                pnlPercent: ((marketData.currentPrice - position.averageEntry) / position.averageEntry) * 100,
            };
        }
        
        // Run analysis through signal engine
        const result = await this.signalEngine.analyze(
            ticker,
            marketData,
            fundamentalData,
            position,
            mode
        );
        
        return result;
    }
    
    /**
     * Batch analyze multiple tickers
     */
    async analyzeMultiple(
        tickers: string[],
        mode: AnalysisMode,
        userPositions?: Map<string, UserPosition>
    ): Promise<AnalysisResult[]> {
        const results = await Promise.all(
            tickers.map(ticker => {
                const position = userPositions?.get(ticker);
                return this.analyzeTicker(ticker, mode, position);
            })
        );
        
        return results;
    }
    
    /**
     * Get current price for a ticker (public method for price updates)
     */
    async getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }> {
        return this.dataProvider.getCurrentPrice(ticker);
    }
    
    /**
     * Convenience function to analyze ETH-USD in swing mode
     * Optimized for ETH swing trading analysis
     */
    async analyzeEthSwing(userPosition?: UserPosition): Promise<AnalysisResult> {
        return this.analyzeTicker('ETH-USD', 'swing', userPosition);
    }
}

