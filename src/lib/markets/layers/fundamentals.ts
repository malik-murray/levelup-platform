/**
 * Fundamentals Data Layer
 * Analyzes basic valuation metrics (PE, PS, market cap, revenue trends)
 * Only applicable to stocks and ETFs
 */

import { BaseDataLayer } from './base';
import { LayerInput, LayerOutput, AnalysisMode } from '../types';

export class FundamentalsLayer extends BaseDataLayer {
    name = 'fundamentals';
    
    isApplicable(mode: AnalysisMode): boolean {
        return mode !== 'risk-only'; // Fundamentals less relevant for pure risk analysis
    }
    
    async analyze(input: LayerInput): Promise<LayerOutput> {
        const { marketData, fundamentalData, mode } = input;
        
        // Fundamentals only apply to stocks and ETFs
        if (marketData.assetType === 'crypto' || !fundamentalData) {
            return {
                score: 5,
                flags: ['not_applicable'],
                notes: 'Fundamental analysis not applicable to this asset type.',
            };
        }
        
        const { pe, ps, revenueGrowth, earningsGrowth } = fundamentalData;
        
        let score = 5;
        const flags: string[] = [];
        
        // PE ratio analysis (lower is generally better, but depends on growth)
        if (pe !== undefined) {
            if (pe < 15) {
                flags.push('low_pe', 'potentially_undervalued');
                score += 1.5;
            } else if (pe > 30) {
                flags.push('high_pe', 'potentially_overvalued');
                score -= 1.5;
            } else if (pe > 50) {
                flags.push('very_high_pe', 'overvalued');
                score -= 2.5;
            }
        }
        
        // Price-to-Sales ratio
        if (ps !== undefined) {
            if (ps < 3) {
                flags.push('low_ps');
                score += 1;
            } else if (ps > 10) {
                flags.push('high_ps');
                score -= 1;
            }
        }
        
        // Revenue growth
        if (revenueGrowth !== undefined) {
            if (revenueGrowth > 20) {
                flags.push('strong_revenue_growth');
                score += 1.5;
            } else if (revenueGrowth > 10) {
                flags.push('moderate_revenue_growth');
                score += 0.5;
            } else if (revenueGrowth < 0) {
                flags.push('negative_revenue_growth');
                score -= 2;
            } else if (revenueGrowth < 5) {
                flags.push('slow_revenue_growth');
                score -= 1;
            }
        }
        
        // Earnings growth
        if (earningsGrowth !== undefined) {
            if (earningsGrowth > 20) {
                flags.push('strong_earnings_growth');
                score += 1;
            } else if (earningsGrowth < 0) {
                flags.push('negative_earnings_growth');
                score -= 1.5;
            }
        }
        
        // Mode-specific weighting
        // Long-term mode emphasizes fundamentals more
        if (mode === 'long-term') {
            // Score already weighted appropriately above
        } else if (mode === 'swing') {
            // Fundamentals matter less for swing trading
            score = 5 + (score - 5) * 0.5;
        }
        
        const notes = this.generateNotes(fundamentalData, mode);
        
        return {
            score: this.normalizeScore(score, 0, 10),
            flags,
            notes,
            metadata: {
                pe,
                ps,
                revenueGrowth,
                earningsGrowth,
            },
        };
    }
    
    private generateNotes(data: {
        pe?: number;
        ps?: number;
        revenueGrowth?: number;
        earningsGrowth?: number;
    }, mode: AnalysisMode): string {
        const parts: string[] = [];
        
        if (data.pe !== undefined) {
            if (data.pe < 15) {
                parts.push(`Low P/E ratio of ${data.pe.toFixed(1)} suggests potential undervaluation.`);
            } else if (data.pe > 30) {
                parts.push(`High P/E ratio of ${data.pe.toFixed(1)} suggests potential overvaluation.`);
            } else {
                parts.push(`P/E ratio of ${data.pe.toFixed(1)} is reasonable.`);
            }
        }
        
        if (data.revenueGrowth !== undefined) {
            if (data.revenueGrowth > 20) {
                parts.push(`Strong revenue growth of ${data.revenueGrowth.toFixed(1)}%.`);
            } else if (data.revenueGrowth < 0) {
                parts.push(`Concerning: revenue is declining (${data.revenueGrowth.toFixed(1)}%).`);
            }
        }
        
        if (mode === 'long-term') {
            parts.push('Fundamentals are particularly important for long-term holdings.');
        }
        
        return parts.length > 0 ? parts.join(' ') : 'Fundamental data available but limited indicators.';
    }
}










