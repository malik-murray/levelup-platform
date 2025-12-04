/**
 * Volume & Volatility Data Layer
 * Analyzes volume patterns and volatility metrics
 */

import { BaseDataLayer } from './base';
import { LayerInput, LayerOutput, AnalysisMode } from '../types';

export class VolumeVolatilityLayer extends BaseDataLayer {
    name = 'volumeVolatility';
    
    isApplicable(mode: AnalysisMode): boolean {
        return true; // Volume and volatility are relevant to all modes
    }
    
    async analyze(input: LayerInput): Promise<LayerOutput> {
        const { marketData, mode } = input;
        const candles = marketData.candles;
        
        if (candles.length < 20) {
            return {
                score: 5,
                flags: ['insufficient_data'],
                notes: 'Not enough data to analyze volume and volatility.',
            };
        }
        
        // Calculate volume metrics
        const avgVolume = this.calculateAverageVolume(candles, 20);
        const recentVolume = candles.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
        const volumeRatio = recentVolume / avgVolume;
        
        // Calculate volatility (standard deviation of returns)
        const returns = candles.slice(-20).map((c, i, arr) => {
            if (i === 0) return 0;
            return (c.close - arr[i - 1].close) / arr[i - 1].close;
        });
        const volatility = this.calculateStdDev(returns) * Math.sqrt(252); // Annualized
        
        // Determine score
        let score = 5;
        const flags: string[] = [];
        
        // Volume analysis
        if (volumeRatio > 1.5) {
            flags.push('high_volume', 'increased_conviction');
            score += 1; // High volume confirms moves
        } else if (volumeRatio < 0.7) {
            flags.push('low_volume', 'weak_conviction');
            score -= 0.5; // Low volume suggests weak moves
        }
        
        // Volatility analysis (higher volatility = higher risk)
        // For risk-only mode, this affects risk score more
        if (volatility > 0.5) {
            flags.push('very_high_volatility');
            if (mode === 'risk-only') {
                score -= 3; // High volatility = bad for risk score
            } else {
                score -= 1; // Still a concern but less critical
            }
        } else if (volatility > 0.3) {
            flags.push('high_volatility');
            if (mode === 'risk-only') {
                score -= 2;
            } else {
                score -= 0.5;
            }
        } else if (volatility < 0.15) {
            flags.push('low_volatility');
            if (mode === 'risk-only') {
                score += 1; // Lower volatility = better for risk
            }
        }
        
        // Combined signals
        if (volumeRatio > 1.5 && volatility < 0.3) {
            flags.push('strong_volume_low_volatility');
            score += 0.5;
        }
        
        const notes = this.generateNotes(volumeRatio, volatility, mode);
        
        return {
            score: this.normalizeScore(score, 0, 10),
            flags,
            notes,
            metadata: {
                volumeRatio,
                volatility,
                avgVolume,
                recentVolume,
            },
        };
    }
    
    private calculateAverageVolume(candles: Array<{ volume: number }>, period: number): number {
        const recent = candles.slice(-period);
        return recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
    }
    
    private calculateStdDev(values: number[]): number {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(variance);
    }
    
    private generateNotes(volumeRatio: number, volatility: number, mode: AnalysisMode): string {
        const volumeState = volumeRatio > 1.5 ? 'high' : volumeRatio < 0.7 ? 'low' : 'normal';
        const volState = volatility > 0.5 ? 'very high' : volatility > 0.3 ? 'high' : volatility < 0.15 ? 'low' : 'moderate';
        
        if (mode === 'risk-only') {
            return `Volatility is ${volState} (${(volatility * 100).toFixed(1)}% annualized). ${volatility > 0.3 ? 'High volatility increases risk.' : 'Lower volatility suggests more stable price action.'}`;
        } else {
            return `Volume is ${volumeState} (${(volumeRatio * 100).toFixed(0)}% of average). Volatility is ${volState} (${(volatility * 100).toFixed(1)}% annualized). ${volumeRatio > 1.5 ? 'High volume confirms recent price action.' : volumeRatio < 0.7 ? 'Low volume suggests weak conviction.' : ''}`;
        }
    }
}

