/**
 * Mode Configurations
 * Defines weightings and thresholds for each analysis mode
 */

import { ModeConfig, AnalysisMode } from './types';

export const MODE_CONFIGS: Record<AnalysisMode, ModeConfig> = {
    'long-term': {
        name: 'long-term',
        displayName: 'Long-Term Investor',
        description: 'Focus on fundamentals, long-term trends, and value. Time horizon: 1-10 years.',
        timeframes: ['1W', '1M'], // Higher timeframes for long-term view
        weights: {
            trend: 0.20,
            momentum: 0.10,
            supportResistance: 0.10,
            volumeVolatility: 0.15,
            fundamentals: 0.35, // Heavily weighted for long-term
            userPosition: 0.10,
        },
        buyThreshold: 6.0,
        sellThreshold: 4.0,
    },
    'swing': {
        name: 'swing',
        displayName: 'Swing Trader',
        description: 'Focus on trends, momentum, and support/resistance. Time horizon: days to weeks.',
        timeframes: ['1D', '4H'], // Mid-range timeframes
        weights: {
            trend: 0.25,
            momentum: 0.25,
            supportResistance: 0.25,
            volumeVolatility: 0.15,
            fundamentals: 0.05, // Less important for swing trading
            userPosition: 0.05,
        },
        buyThreshold: 6.5,
        sellThreshold: 4.5,
    },
    'risk-only': {
        name: 'risk-only',
        displayName: 'Risk-Only / Beginner',
        description: 'Focus on volatility, risk metrics, and suitability. For new investors.',
        timeframes: ['1D', '1W'], // Multi-timeframe for risk assessment
        weights: {
            trend: 0.15,
            momentum: 0.05,
            supportResistance: 0.05,
            volumeVolatility: 0.60, // Heavily weighted - volatility is key
            fundamentals: 0.10,
            userPosition: 0.05,
        },
        buyThreshold: 5.0, // Lower threshold - focus on risk not entry
        sellThreshold: 5.0,
    },
};

/**
 * Get configuration for a specific mode
 */
export function getModeConfig(mode: AnalysisMode): ModeConfig {
    return MODE_CONFIGS[mode];
}

/**
 * Get all available modes
 */
export function getAvailableModes(): AnalysisMode[] {
    return Object.keys(MODE_CONFIGS) as AnalysisMode[];
}







