/**
 * Momentum Data Layer
 * Uses RSI and MACD-like indicators to assess momentum
 */

import { BaseDataLayer } from './base';
import { LayerInput, LayerOutput, AnalysisMode } from '../types';

export class MomentumLayer extends BaseDataLayer {
    name = 'momentum';
    
    isApplicable(mode: AnalysisMode): boolean {
        return mode !== 'risk-only'; // Momentum is less relevant for risk-only mode
    }
    
    async analyze(input: LayerInput): Promise<LayerOutput> {
        const { marketData } = input;
        const candles = marketData.candles;
        
        if (candles.length < 14) {
            return {
                score: 5,
                flags: ['insufficient_data'],
                notes: 'Not enough data to calculate momentum indicators.',
            };
        }
        
        // Calculate RSI
        const rsi = this.calculateRSI(candles, 14);
        
        // Calculate MACD-like signal
        const macdSignal = this.calculateMACDSignal(candles);
        
        // Determine score based on RSI and MACD
        let score = 5;
        const flags: string[] = [];
        
        // RSI interpretation
        if (rsi > 70) {
            flags.push('overbought_rsi');
            score -= 2;
        } else if (rsi > 60) {
            flags.push('approaching_overbought');
            score -= 1;
        } else if (rsi < 30) {
            flags.push('oversold_rsi');
            score += 2;
        } else if (rsi < 40) {
            flags.push('approaching_oversold');
            score += 1;
        }
        
        // MACD interpretation
        if (macdSignal.bullish) {
            flags.push('bullish_macd');
            score += 1.5;
        } else if (macdSignal.bearish) {
            flags.push('bearish_macd');
            score -= 1.5;
        }
        
        // Combined momentum assessment
        if (rsi < 40 && macdSignal.bullish) {
            flags.push('strong_bullish_momentum');
            score += 1;
        } else if (rsi > 70 && macdSignal.bearish) {
            flags.push('strong_bearish_momentum');
            score -= 1;
        }
        
        const notes = this.generateNotes(rsi, macdSignal);
        
        return {
            score: this.normalizeScore(score, 0, 10),
            flags,
            notes,
            metadata: {
                rsi,
                macd: macdSignal,
            },
        };
    }
    
    private calculateRSI(candles: Array<{ close: number }>, period: number): number {
        if (candles.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = candles.length - period; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    private calculateMACDSignal(candles: Array<{ close: number }>): {
        bullish: boolean;
        bearish: boolean;
        value: number;
    } {
        if (candles.length < 26) {
            return { bullish: false, bearish: false, value: 0 };
        }
        
        // Simplified MACD: fast EMA - slow EMA
        const fastEMA = this.calculateEMA(candles, 12);
        const slowEMA = this.calculateEMA(candles, 26);
        
        const macd = fastEMA - slowEMA;
        const signalLine = this.calculateEMA(
            candles.map((c, i) => ({ close: macd })), 
            9
        ) || macd * 0.9;
        
        const bullish = macd > signalLine && macd > 0;
        const bearish = macd < signalLine && macd < 0;
        
        return { bullish, bearish, value: macd };
    }
    
    private calculateEMA(candles: Array<{ close: number }>, period: number): number {
        if (candles.length < period) {
            // Fallback to SMA
            return candles.reduce((sum, c) => sum + c.close, 0) / candles.length;
        }
        
        const multiplier = 2 / (period + 1);
        let ema = candles[candles.length - period].close;
        
        for (let i = candles.length - period + 1; i < candles.length; i++) {
            ema = (candles[i].close - ema) * multiplier + ema;
        }
        
        return ema;
    }
    
    private generateNotes(rsi: number, macdSignal: { bullish: boolean; bearish: boolean }): string {
        const rsiState = rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral';
        const macdState = macdSignal.bullish ? 'bullish' : macdSignal.bearish ? 'bearish' : 'neutral';
        
        if (rsiState === 'oversold' && macdState === 'bullish') {
            return `Strong bullish momentum. RSI is oversold (${rsi.toFixed(1)}) and MACD is bullish, suggesting a potential buying opportunity.`;
        } else if (rsiState === 'overbought' && macdState === 'bearish') {
            return `Strong bearish momentum. RSI is overbought (${rsi.toFixed(1)}) and MACD is bearish, suggesting caution or potential selling.`;
        } else if (rsiState === 'oversold') {
            return `RSI is oversold (${rsi.toFixed(1)}), indicating potential bounce. Monitor for reversal signals.`;
        } else if (rsiState === 'overbought') {
            return `RSI is overbought (${rsi.toFixed(1)}), indicating potential pullback. Consider taking profits.`;
        } else {
            return `Momentum is neutral. RSI at ${rsi.toFixed(1)}. Wait for clearer signals.`;
        }
    }
}








