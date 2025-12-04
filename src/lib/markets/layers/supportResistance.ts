/**
 * Support/Resistance Data Layer
 * Detects recent swing highs, swing lows, and key reversal areas
 */

import { BaseDataLayer } from './base';
import { LayerInput, LayerOutput, AnalysisMode } from '../types';

export class SupportResistanceLayer extends BaseDataLayer {
    name = 'supportResistance';
    
    isApplicable(mode: AnalysisMode): boolean {
        return mode !== 'risk-only'; // Less relevant for risk-only mode
    }
    
    async analyze(input: LayerInput): Promise<LayerOutput> {
        const { marketData } = input;
        const candles = marketData.candles;
        
        if (candles.length < 10) {
            return {
                score: 5,
                flags: ['insufficient_data'],
                notes: 'Not enough data to identify support and resistance levels.',
            };
        }
        
        const currentPrice = candles[candles.length - 1].close;
        
        // Find swing highs and lows
        const swingHighs = this.findSwingHighs(candles);
        const swingLows = this.findSwingLows(candles);
        
        // Find nearest support and resistance
        const resistance = this.findNearestResistance(currentPrice, swingHighs);
        const support = this.findNearestSupport(currentPrice, swingLows);
        
        // Determine position relative to support/resistance
        const distanceToResistance = resistance ? (resistance - currentPrice) / currentPrice : Infinity;
        const distanceToSupport = support ? (currentPrice - support) / currentPrice : Infinity;
        
        let score = 5;
        const flags: string[] = [];
        
        // Near support = bullish
        if (distanceToSupport < 0.02 && support !== null) {
            flags.push('near_support', 'potential_bounce');
            score += 2.5;
        } else if (distanceToSupport < 0.05 && support !== null) {
            flags.push('approaching_support');
            score += 1;
        }
        
        // Near resistance = bearish
        if (distanceToResistance < 0.02 && resistance !== null) {
            flags.push('near_resistance', 'potential_rejection');
            score -= 2.5;
        } else if (distanceToResistance < 0.05 && resistance !== null) {
            flags.push('approaching_resistance');
            score -= 1;
        }
        
        // Mid-range
        if (distanceToSupport > 0.05 && distanceToResistance > 0.05) {
            flags.push('mid_range');
        }
        
        const notes = this.generateNotes(currentPrice, support, resistance, distanceToSupport, distanceToResistance);
        
        return {
            score: this.normalizeScore(score, 0, 10),
            flags,
            notes,
            metadata: {
                support,
                resistance,
                distanceToSupport,
                distanceToResistance,
                swingHighs: swingHighs.slice(-5), // Last 5
                swingLows: swingLows.slice(-5), // Last 5
            },
        };
    }
    
    private findSwingHighs(candles: Array<{ high: number }>, lookback: number = 3): number[] {
        const highs: number[] = [];
        
        for (let i = lookback; i < candles.length - lookback; i++) {
            let isSwingHigh = true;
            const currentHigh = candles[i].high;
            
            // Check if this high is higher than surrounding candles
            for (let j = i - lookback; j <= i + lookback; j++) {
                if (j !== i && candles[j].high >= currentHigh) {
                    isSwingHigh = false;
                    break;
                }
            }
            
            if (isSwingHigh) {
                highs.push(currentHigh);
            }
        }
        
        return highs;
    }
    
    private findSwingLows(candles: Array<{ low: number }>, lookback: number = 3): number[] {
        const lows: number[] = [];
        
        for (let i = lookback; i < candles.length - lookback; i++) {
            let isSwingLow = true;
            const currentLow = candles[i].low;
            
            // Check if this low is lower than surrounding candles
            for (let j = i - lookback; j <= i + lookback; j++) {
                if (j !== i && candles[j].low <= currentLow) {
                    isSwingLow = false;
                    break;
                }
            }
            
            if (isSwingLow) {
                lows.push(currentLow);
            }
        }
        
        return lows;
    }
    
    private findNearestResistance(currentPrice: number, swingHighs: number[]): number | null {
        const above = swingHighs.filter(h => h > currentPrice);
        return above.length > 0 ? Math.min(...above) : null;
    }
    
    private findNearestSupport(currentPrice: number, swingLows: number[]): number | null {
        const below = swingLows.filter(l => l < currentPrice);
        return below.length > 0 ? Math.max(...below) : null;
    }
    
    private generateNotes(
        currentPrice: number,
        support: number | null,
        resistance: number | null,
        distToSupport: number,
        distToResistance: number
    ): string {
        if (support && distToSupport < 0.02) {
            return `Price is near support at $${support.toFixed(2)}. This could be a good entry point if support holds.`;
        } else if (resistance && distToResistance < 0.02) {
            return `Price is near resistance at $${resistance.toFixed(2)}. Consider taking profits or waiting for a breakout.`;
        } else if (support && distToSupport < 0.05) {
            return `Price is approaching support at $${support.toFixed(2)}. Monitor for potential bounce.`;
        } else if (resistance && distToResistance < 0.05) {
            return `Price is approaching resistance at $${resistance.toFixed(2)}. Watch for potential rejection.`;
        } else {
            return `Price is in mid-range. Support: ${support ? `$${support.toFixed(2)}` : 'none'}, Resistance: ${resistance ? `$${resistance.toFixed(2)}` : 'none'}.`;
        }
    }
}

