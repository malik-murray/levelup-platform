/**
 * Price & Trend Data Layer
 * Determines if asset is in uptrend, downtrend, or sideways/range
 */

import { BaseDataLayer } from './base';
import { LayerInput, LayerOutput, AnalysisMode } from '../types';

export class TrendLayer extends BaseDataLayer {
    name = 'trend';
    
    isApplicable(mode: AnalysisMode): boolean {
        return true; // Trend is applicable to all modes
    }
    
    async analyze(input: LayerInput): Promise<LayerOutput> {
        const { marketData } = input;
        const candles = marketData.candles;
        
        if (candles.length < 20) {
            return {
                score: 5,
                flags: ['insufficient_data'],
                notes: 'Not enough price data to determine trend.',
            };
        }
        
        // Simple trend detection using moving averages
        const shortPeriod = Math.min(10, Math.floor(candles.length / 3));
        const longPeriod = Math.min(20, Math.floor(candles.length / 2));
        
        const shortMA = this.calculateMA(candles, shortPeriod);
        const longMA = this.calculateMA(candles, longPeriod);
        
        const currentPrice = candles[candles.length - 1].close;
        const priceVsShortMA = (currentPrice - shortMA) / shortMA;
        const priceVsLongMA = (currentPrice - longMA) / longMA;
        const shortVsLongMA = (shortMA - longMA) / longMA;
        
        // Determine trend direction
        let trend: 'uptrend' | 'downtrend' | 'range' = 'range';
        let score = 5; // Neutral
        const flags: string[] = [];
        
        if (shortMA > longMA * 1.02 && priceVsLongMA > 0.02) {
            trend = 'uptrend';
            score = 6 + Math.min(4, shortVsLongMA * 100); // 6-10
            flags.push('uptrend', 'price_above_moving_averages');
        } else if (shortMA < longMA * 0.98 && priceVsLongMA < -0.02) {
            trend = 'downtrend';
            score = 4 - Math.min(4, Math.abs(shortVsLongMA) * 100); // 0-4
            flags.push('downtrend', 'price_below_moving_averages');
        } else {
            trend = 'range';
            score = 5;
            flags.push('range', 'sideways_movement');
        }
        
        // Additional signals
        if (priceVsShortMA > 0.05) {
            flags.push('price_extended_above_short_ma');
        }
        if (priceVsShortMA < -0.05) {
            flags.push('price_extended_below_short_ma');
        }
        
        const notes = this.generateNotes(trend, currentPrice, shortMA, longMA);
        
        return {
            score: this.normalizeScore(score, 0, 10),
            flags,
            notes,
            metadata: {
                trend,
                shortMA,
                longMA,
                currentPrice,
            },
        };
    }
    
    private calculateMA(candles: Array<{ close: number }>, period: number): number {
        const recent = candles.slice(-period);
        const sum = recent.reduce((acc, candle) => acc + candle.close, 0);
        return sum / recent.length;
    }
    
    private generateNotes(
        trend: 'uptrend' | 'downtrend' | 'range',
        currentPrice: number,
        shortMA: number,
        longMA: number
    ): string {
        if (trend === 'uptrend') {
            return `Asset is in an uptrend. Price is above moving averages, suggesting bullish momentum. Consider buying dips.`;
        } else if (trend === 'downtrend') {
            return `Asset is in a downtrend. Price is below moving averages, suggesting bearish momentum. Consider selling strength or avoiding new entries.`;
        } else {
            return `Asset is trading in a range. No clear directional bias. Wait for a breakout above resistance or breakdown below support.`;
        }
    }
}





