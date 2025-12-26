/**
 * LevelUp Finance - Universal Analyzer Types
 * Core types and interfaces for the multi-asset, multi-mode financial analyzer
 */

// ============================================================================
// Asset Types
// ============================================================================

export type AssetType = 'stock' | 'crypto' | 'etf';

export type MarketRegime = 'bull' | 'bear' | 'range';

export type AnalysisMode = 'long-term' | 'swing' | 'risk-only';

// ============================================================================
// Market Data Types
// ============================================================================

export interface OHLCV {
    timestamp: number; // Unix timestamp in milliseconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface MarketData {
    ticker: string;
    assetType: AssetType;
    currentPrice: number;
    change24h?: number;
    changePercent24h?: number;
    candles: OHLCV[];
    timeframe: string; // '1D', '4H', '1W', '1M', etc.
}

export interface FundamentalData {
    pe?: number;
    ps?: number; // Price-to-Sales
    marketCap?: number;
    revenue?: number;
    revenueGrowth?: number; // YoY growth %
    earnings?: number;
    earningsGrowth?: number; // YoY growth %
}

// ============================================================================
// Market Data Provider Interface
// ============================================================================

/**
 * Abstract interface for market data providers
 * Allows switching between mock data, Polygon, Alpha Vantage, Binance, etc.
 */
export interface MarketDataProvider {
    /**
     * Fetch current price and basic info for a ticker
     */
    getCurrentPrice(ticker: string): Promise<{ price: number; change24h?: number; changePercent24h?: number }>;
    
    /**
     * Fetch historical OHLCV candles
     */
    getCandles(ticker: string, timeframe: string, limit?: number): Promise<OHLCV[]>;
    
    /**
     * Detect asset type from ticker (stocks vs crypto vs ETF)
     */
    detectAssetType(ticker: string): Promise<AssetType>;
    
    /**
     * Fetch fundamental data (stocks/ETFs only)
     */
    getFundamentals(ticker: string): Promise<FundamentalData | null>;
}

// ============================================================================
// Data Layer Types
// ============================================================================

/**
 * Standardized output from each data layer
 * All layers must return this format
 */
export interface LayerOutput {
    score: number; // 0-10 contribution to buy/sell signal
    flags: string[]; // e.g., ["overbought", "near_support", "bullish_macd"]
    notes: string; // Plain-English description
    metadata?: Record<string, any>; // Additional structured data
}

/**
 * Input to data layers
 */
export interface LayerInput {
    marketData: MarketData;
    fundamentalData?: FundamentalData;
    userPosition?: UserPosition;
    mode: AnalysisMode;
}

// ============================================================================
// Data Layer Interface
// ============================================================================

/**
 * All data layers must implement this interface
 * This ensures modularity - layers can be added/removed without changing core logic
 */
export interface DataLayer {
    /**
     * Unique identifier for this layer
     */
    name: string;
    
    /**
     * Process market data and return standardized output
     */
    analyze(input: LayerInput): Promise<LayerOutput>;
    
    /**
     * Whether this layer is applicable for the given mode
     */
    isApplicable(mode: AnalysisMode): boolean;
}

// ============================================================================
// Mode Configuration
// ============================================================================

export interface ModeWeights {
    trend: number;
    momentum: number;
    supportResistance: number;
    volumeVolatility: number;
    fundamentals: number;
    userPosition: number;
}

export interface ModeConfig {
    name: AnalysisMode;
    displayName: string;
    description: string;
    timeframes: string[]; // Preferred timeframes for this mode
    weights: ModeWeights;
    buyThreshold: number; // Minimum buy score
    sellThreshold: number; // Minimum sell score
}

// ============================================================================
// User Position Types
// ============================================================================

export interface UserPosition {
    ticker: string;
    averageEntry: number;
    quantity: number;
    currentPrice: number;
    pnl: number; // Total P&L in dollars
    pnlPercent: number; // P&L percentage
    riskTolerance?: 'low' | 'medium' | 'high';
}

// ============================================================================
// Analysis Result Types
// ============================================================================

export interface LayerBreakdown {
    trend: number;
    momentum: number;
    supportResistance: number;
    volumeVolatility: number;
    fundamentals: number;
    userPosition: number;
}

export interface KeyFactor {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
}

export type SuggestedAction = 
    | 'accumulate_small'
    | 'accumulate_aggressive'
    | 'take_partial_profits'
    | 'take_full_profits'
    | 'hold'
    | 'avoid_new_entries'
    | 'consider_exit'
    | 'no_action';

export interface AnalysisResult {
    ticker: string;
    assetType: AssetType;
    mode: AnalysisMode;
    timestamp: number;
    
    // Core Scores
    buyScore: number; // 0-10
    sellScore: number; // 0-10
    riskScore: number; // 0-100
    
    // Market Context
    marketRegime: MarketRegime;
    currentPrice: number;
    
    // Explanations
    explanation: string; // 1-3 sentences
    suggestedAction: SuggestedAction;
    keyFactors: KeyFactor[];
    
    // Layer Breakdown
    layerBreakdown: LayerBreakdown;
    
    // Metadata for logging
    layerOutputs: Record<string, LayerOutput>;
}

// ============================================================================
// Signal Log Types
// ============================================================================

export interface SignalLog extends AnalysisResult {
    userId?: string;
    inputs: {
        timeframes: string[];
        weights: ModeWeights;
    };
}








