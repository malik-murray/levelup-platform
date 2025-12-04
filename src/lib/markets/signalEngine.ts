/**
 * Unified Signal Engine
 * Core engine that combines all data layers and produces Buy/Sell/Risk scores
 */

import {
    AnalysisResult,
    LayerOutput,
    ModeWeights,
    MarketRegime,
    SuggestedAction,
    KeyFactor,
    LayerBreakdown,
    AnalysisMode,
    MarketData,
    FundamentalData,
    UserPosition,
} from './types';
import { DataLayer } from './types';
import { getModeConfig } from './modes';
import { SignalLogger, noOpLogger } from './signalLogger';

export class SignalEngine {
    private layers: DataLayer[];
    private logger: SignalLogger;
    
    constructor(layers: DataLayer[], logger?: SignalLogger) {
        this.layers = layers;
        this.logger = logger || noOpLogger;
    }
    
    /**
     * Analyze a ticker and produce comprehensive analysis result
     */
    async analyze(
        ticker: string,
        marketData: MarketData,
        fundamentalData: FundamentalData | null,
        userPosition: UserPosition | undefined,
        mode: AnalysisMode
    ): Promise<AnalysisResult> {
        const modeConfig = getModeConfig(mode);
        const layerInput = {
            marketData,
            fundamentalData: fundamentalData || undefined,
            userPosition,
            mode,
        };
        
        // Run all applicable layers
        const layerOutputs: Record<string, LayerOutput> = {};
        
        for (const layer of this.layers) {
            if (layer.isApplicable(mode)) {
                try {
                    const output = await layer.analyze(layerInput);
                    layerOutputs[layer.name] = output;
                } catch (error) {
                    console.error(`Error in layer ${layer.name}:`, error);
                    // Use neutral output on error
                    layerOutputs[layer.name] = {
                        score: 5,
                        flags: ['layer_error'],
                        notes: `Error analyzing ${layer.name}`,
                    };
                }
            }
        }
        
        // Calculate weighted scores
        const buyScore = this.calculateBuyScore(layerOutputs, modeConfig.weights);
        const sellScore = this.calculateSellScore(layerOutputs, modeConfig.weights);
        const riskScore = this.calculateRiskScore(layerOutputs, marketData, mode);
        
        // Determine market regime
        const marketRegime = this.determineMarketRegime(layerOutputs, buyScore, sellScore);
        
        // Generate explanation
        const explanation = this.generateExplanation(layerOutputs, buyScore, sellScore, marketRegime, mode);
        
        // Determine suggested action
        const suggestedAction = this.determineSuggestedAction(buyScore, sellScore, riskScore, userPosition);
        
        // Extract key factors
        const keyFactors = this.extractKeyFactors(layerOutputs);
        
        // Build layer breakdown
        const layerBreakdown = this.buildLayerBreakdown(layerOutputs);
        
        const result: AnalysisResult = {
            ticker,
            assetType: marketData.assetType,
            mode,
            timestamp: Date.now(),
            buyScore,
            sellScore,
            riskScore,
            marketRegime,
            currentPrice: marketData.currentPrice,
            explanation,
            suggestedAction,
            keyFactors,
            layerBreakdown,
            layerOutputs,
        };
        
        // Log the analysis result (non-blocking)
        this.logger.log(result).catch(error => {
            console.error('Failed to log signal:', error);
            // Don't throw - logging failure shouldn't break analysis
        });
        
        return result;
    }
    
    /**
     * Calculate Buy Score (0-10) from weighted layer outputs
     * Uses mode-specific weights and considers layer flags for meaningful adjustments
     */
    private calculateBuyScore(layerOutputs: Record<string, LayerOutput>, weights: ModeWeights): number {
        let weightedSum = 0;
        let totalWeight = 0;
        
        // Trend contributes to buy score (higher = more bullish)
        if (layerOutputs.trend) {
            let trendScore = layerOutputs.trend.score;
            const flags = layerOutputs.trend.flags;
            
            // Enhance score based on flags
            if (flags.includes('uptrend')) {
                trendScore = Math.min(10, trendScore + 0.5); // Boost uptrends
            }
            if (flags.includes('price_extended_above_short_ma')) {
                trendScore = Math.max(0, trendScore - 0.5); // Slightly reduce if extended
            }
            
            const weight = weights.trend;
            weightedSum += trendScore * weight;
            totalWeight += weight;
        }
        
        // Momentum contributes to buy score
        if (layerOutputs.momentum) {
            let momentumScore = layerOutputs.momentum.score;
            const flags = layerOutputs.momentum.flags;
            
            // Enhance based on momentum flags
            if (flags.includes('strong_bullish_momentum')) {
                momentumScore = Math.min(10, momentumScore + 1.0); // Strong boost
            } else if (flags.includes('oversold_rsi') && flags.includes('bullish_macd')) {
                momentumScore = Math.min(10, momentumScore + 0.5); // Good setup
            }
            if (flags.includes('overbought_rsi')) {
                momentumScore = Math.max(0, momentumScore - 1.0); // Reduce if overbought
            }
            
            const weight = weights.momentum;
            weightedSum += momentumScore * weight;
            totalWeight += weight;
        }
        
        // Support/Resistance - higher score = near support = bullish
        if (layerOutputs.supportResistance) {
            let srScore = layerOutputs.supportResistance.score;
            const flags = layerOutputs.supportResistance.flags;
            
            // Enhance based on S/R flags
            if (flags.includes('near_support') && flags.includes('potential_bounce')) {
                srScore = Math.min(10, srScore + 1.0); // Strong buy signal
            }
            if (flags.includes('near_resistance')) {
                srScore = Math.max(0, srScore - 1.5); // Strong resistance = reduce buy
            }
            
            const weight = weights.supportResistance;
            weightedSum += srScore * weight;
            totalWeight += weight;
        }
        
        // Volume/Volatility - high volume confirms, low volatility preferred
        if (layerOutputs.volumeVolatility) {
            let volScore = layerOutputs.volumeVolatility.score;
            const flags = layerOutputs.volumeVolatility.flags;
            
            // Enhance based on volume flags
            if (flags.includes('high_volume') && flags.includes('increased_conviction')) {
                volScore = Math.min(10, volScore + 0.5); // Volume confirms
            }
            if (flags.includes('low_volume')) {
                volScore = Math.max(0, volScore - 0.5); // Weak volume
            }
            
            const weight = weights.volumeVolatility;
            weightedSum += volScore * weight;
            totalWeight += weight;
        }
        
        // Fundamentals - undervalued = good for buying
        if (layerOutputs.fundamentals) {
            let fundScore = layerOutputs.fundamentals.score;
            const flags = layerOutputs.fundamentals.flags;
            
            // Enhance based on fundamental flags
            if (flags.includes('low_pe') && flags.includes('potentially_undervalued')) {
                fundScore = Math.min(10, fundScore + 0.5); // Undervalued boost
            }
            if (flags.includes('strong_revenue_growth') && flags.includes('strong_earnings_growth')) {
                fundScore = Math.min(10, fundScore + 0.5); // Growth boost
            }
            if (flags.includes('very_high_pe') || flags.includes('overvalued')) {
                fundScore = Math.max(0, fundScore - 1.0); // Overvalued reduction
            }
            
            const weight = weights.fundamentals;
            weightedSum += fundScore * weight;
            totalWeight += weight;
        }
        
        // User Position - if up big, might want to sell not buy
        if (layerOutputs.userPosition) {
            let positionScore = layerOutputs.userPosition.score;
            const flags = layerOutputs.userPosition.flags;
            
            // Invert for buy score - if position suggests sell, reduce buy score
            positionScore = 10 - positionScore;
            
            // Additional adjustments based on flags
            if (flags.includes('large_profit')) {
                positionScore = Math.max(0, positionScore - 1.0); // Don't buy more if up big
            }
            
            const weight = weights.userPosition;
            weightedSum += positionScore * weight;
            totalWeight += weight;
        }
        
        if (totalWeight === 0) return 5;
        
        return Math.max(0, Math.min(10, Math.round((weightedSum / totalWeight) * 10) / 10));
    }
    
    /**
     * Calculate Sell Score (0-10) from weighted layer outputs
     * Uses mode-specific weights and considers layer flags for meaningful adjustments
     */
    private calculateSellScore(layerOutputs: Record<string, LayerOutput>, weights: ModeWeights): number {
        let weightedSum = 0;
        let totalWeight = 0;
        
        // Trend - downtrend = higher sell score
        if (layerOutputs.trend) {
            let trendScore = 10 - layerOutputs.trend.score; // Invert for sell
            const flags = layerOutputs.trend.flags;
            
            // Enhance score based on flags
            if (flags.includes('downtrend')) {
                trendScore = Math.min(10, trendScore + 0.5); // Boost downtrends
            }
            if (flags.includes('price_extended_below_short_ma')) {
                trendScore = Math.max(0, trendScore - 0.5); // Slightly reduce if oversold
            }
            
            const weight = weights.trend;
            weightedSum += trendScore * weight;
            totalWeight += weight;
        }
        
        // Momentum - overbought = higher sell score
        if (layerOutputs.momentum) {
            let momentumScore = 10 - layerOutputs.momentum.score; // Invert for sell
            const flags = layerOutputs.momentum.flags;
            
            // Enhance based on momentum flags
            if (flags.includes('strong_bearish_momentum')) {
                momentumScore = Math.min(10, momentumScore + 1.0); // Strong sell signal
            } else if (flags.includes('overbought_rsi') && flags.includes('bearish_macd')) {
                momentumScore = Math.min(10, momentumScore + 0.5); // Good sell setup
            }
            if (flags.includes('oversold_rsi')) {
                momentumScore = Math.max(0, momentumScore - 1.0); // Reduce if oversold
            }
            
            const weight = weights.momentum;
            weightedSum += momentumScore * weight;
            totalWeight += weight;
        }
        
        // Support/Resistance - near resistance = higher sell score
        if (layerOutputs.supportResistance) {
            let srScore = 10 - layerOutputs.supportResistance.score; // Invert for sell
            const flags = layerOutputs.supportResistance.flags;
            
            // Enhance based on S/R flags
            if (flags.includes('near_resistance') && flags.includes('potential_rejection')) {
                srScore = Math.min(10, srScore + 1.0); // Strong sell signal
            }
            if (flags.includes('near_support')) {
                srScore = Math.max(0, srScore - 1.5); // Near support = reduce sell
            }
            
            const weight = weights.supportResistance;
            weightedSum += srScore * weight;
            totalWeight += weight;
        }
        
        // Volume/Volatility - use score properly, enhance with flags
        if (layerOutputs.volumeVolatility) {
            // For sell: high volatility = higher risk = consider selling
            // Invert the score since higher volatility score means lower buy confidence
            let volScore = 10 - layerOutputs.volumeVolatility.score;
            const flags = layerOutputs.volumeVolatility.flags;
            
            // Enhance based on volatility flags
            if (flags.includes('very_high_volatility')) {
                volScore = Math.min(10, volScore + 1.5); // Very high volatility = strong sell signal
            } else if (flags.includes('high_volatility')) {
                volScore = Math.min(10, volScore + 0.5); // High volatility = risk
            }
            if (flags.includes('low_volatility')) {
                volScore = Math.max(0, volScore - 0.5); // Low volatility = less reason to sell
            }
            
            const weight = weights.volumeVolatility;
            weightedSum += volScore * weight;
            totalWeight += weight;
        }
        
        // Fundamentals - overvalued = good for selling
        if (layerOutputs.fundamentals) {
            let fundScore = 10 - layerOutputs.fundamentals.score; // Invert for sell
            const flags = layerOutputs.fundamentals.flags;
            
            // Enhance based on fundamental flags
            if (flags.includes('very_high_pe') || flags.includes('overvalued')) {
                fundScore = Math.min(10, fundScore + 0.5); // Overvalued boost
            }
            if (flags.includes('negative_revenue_growth') || flags.includes('negative_earnings_growth')) {
                fundScore = Math.min(10, fundScore + 0.5); // Declining fundamentals
            }
            if (flags.includes('low_pe') && flags.includes('potentially_undervalued')) {
                fundScore = Math.max(0, fundScore - 1.0); // Undervalued = don't sell
            }
            
            const weight = weights.fundamentals;
            weightedSum += fundScore * weight;
            totalWeight += weight;
        }
        
        // User Position - if up big, might want to sell
        if (layerOutputs.userPosition) {
            let positionScore = layerOutputs.userPosition.score;
            const flags = layerOutputs.userPosition.flags;
            
            // Enhance based on position flags
            if (flags.includes('large_profit') || flags.includes('significant_profit')) {
                positionScore = Math.min(10, positionScore + 0.5); // Take profits
            }
            
            const weight = weights.userPosition;
            weightedSum += positionScore * weight;
            totalWeight += weight;
        }
        
        if (totalWeight === 0) return 5;
        
        return Math.max(0, Math.min(10, Math.round((weightedSum / totalWeight) * 10) / 10));
    }
    
    /**
     * Calculate Risk Score (0-100) from layer outputs using mode-specific weights
     * Higher = more risky
     * Risk-Only mode: Volatility dominates (60% weight)
     */
    private calculateRiskScore(
        layerOutputs: Record<string, LayerOutput>,
        marketData: MarketData,
        mode: AnalysisMode
    ): number {
        const modeConfig = getModeConfig(mode);
        const weights = modeConfig.weights;
        
        // Calculate base risk components
        const riskComponents: Record<string, number> = {};
        
        // Volatility is THE major risk factor (especially for risk-only mode)
        if (layerOutputs.volumeVolatility) {
            const volatility = layerOutputs.volumeVolatility.metadata?.volatility || 0;
            const flags = layerOutputs.volumeVolatility.flags;
            
            // Convert volatility to 0-100 risk score
            let volatilityRisk = 50; // Start neutral
            if (volatility > 0.5) {
                volatilityRisk = 85; // Very high risk
            } else if (volatility > 0.4) {
                volatilityRisk = 75;
            } else if (volatility > 0.3) {
                volatilityRisk = 65;
            } else if (volatility > 0.2) {
                volatilityRisk = 50;
            } else if (volatility > 0.15) {
                volatilityRisk = 40;
            } else {
                volatilityRisk = 30; // Low volatility = lower risk
            }
            
            // Adjust based on flags
            if (flags.includes('very_high_volatility')) {
                volatilityRisk = Math.min(100, volatilityRisk + 10);
            }
            if (flags.includes('high_volatility')) {
                volatilityRisk = Math.min(100, volatilityRisk + 5);
            }
            if (flags.includes('low_volatility')) {
                volatilityRisk = Math.max(0, volatilityRisk - 5);
            }
            
            riskComponents.volatility = volatilityRisk;
        } else {
            riskComponents.volatility = 50; // Default if no data
        }
        
        // Trend - downtrend = higher risk, uptrend = lower risk
        if (layerOutputs.trend) {
            const flags = layerOutputs.trend.flags;
            let trendRisk = 50;
            
            if (flags.includes('downtrend')) {
                trendRisk = 70; // Downtrend = higher risk
            } else if (flags.includes('uptrend')) {
                trendRisk = 35; // Uptrend = lower risk
            } else if (flags.includes('range')) {
                trendRisk = 55; // Range = uncertainty = slight risk
            }
            
            riskComponents.trend = trendRisk;
        } else {
            riskComponents.trend = 50;
        }
        
        // Momentum - overbought/oversold conditions affect risk
        if (layerOutputs.momentum) {
            const flags = layerOutputs.momentum.flags;
            let momentumRisk = 50;
            
            if (flags.includes('overbought_rsi')) {
                momentumRisk = 60; // Overbought = risk of reversal
            } else if (flags.includes('oversold_rsi')) {
                momentumRisk = 55; // Oversold = risk but potential bounce
            }
            
            riskComponents.momentum = momentumRisk;
        } else {
            riskComponents.momentum = 50;
        }
        
        // Support/Resistance - near resistance = risk, near support = less risk
        if (layerOutputs.supportResistance) {
            const flags = layerOutputs.supportResistance.flags;
            let srRisk = 50;
            
            if (flags.includes('near_resistance')) {
                srRisk = 60; // Near resistance = risk of rejection
            } else if (flags.includes('near_support')) {
                srRisk = 40; // Near support = less risk
            }
            
            riskComponents.supportResistance = srRisk;
        } else {
            riskComponents.supportResistance = 50;
        }
        
        // Fundamentals - weak fundamentals = risk (long-term)
        if (layerOutputs.fundamentals) {
            const flags = layerOutputs.fundamentals.flags;
            let fundRisk = 50;
            
            if (flags.includes('negative_revenue_growth') || flags.includes('negative_earnings_growth')) {
                fundRisk = 70; // Declining = risk
            } else if (flags.includes('strong_revenue_growth') && flags.includes('strong_earnings_growth')) {
                fundRisk = 35; // Strong growth = less risk
            }
            
            riskComponents.fundamentals = fundRisk;
        } else {
            riskComponents.fundamentals = 50;
        }
        
        // User Position - large losses = risk
        if (layerOutputs.userPosition) {
            const pnlPercent = layerOutputs.userPosition.metadata?.pnlPercent || 0;
            const flags = layerOutputs.userPosition.flags;
            let positionRisk = 50;
            
            if (pnlPercent < -30 || flags.includes('large_loss')) {
                positionRisk = 80; // Large losses = high risk
            } else if (pnlPercent < -15 || flags.includes('significant_loss')) {
                positionRisk = 65; // Significant losses = risk
            } else if (pnlPercent > 25) {
                positionRisk = 45; // Large profits = less risk (can exit)
            }
            
            riskComponents.userPosition = positionRisk;
        } else {
            riskComponents.userPosition = 50;
        }
        
        // Calculate weighted risk score using mode weights
        // For risk-only mode, volatility gets 60% weight
        let weightedRisk = 0;
        let totalWeight = 0;
        
        if (riskComponents.volatility !== undefined) {
            weightedRisk += riskComponents.volatility * weights.volumeVolatility;
            totalWeight += weights.volumeVolatility;
        }
        
        if (riskComponents.trend !== undefined) {
            weightedRisk += riskComponents.trend * weights.trend;
            totalWeight += weights.trend;
        }
        
        if (riskComponents.momentum !== undefined) {
            weightedRisk += riskComponents.momentum * weights.momentum;
            totalWeight += weights.momentum;
        }
        
        if (riskComponents.supportResistance !== undefined) {
            weightedRisk += riskComponents.supportResistance * weights.supportResistance;
            totalWeight += weights.supportResistance;
        }
        
        if (riskComponents.fundamentals !== undefined) {
            weightedRisk += riskComponents.fundamentals * weights.fundamentals;
            totalWeight += weights.fundamentals;
        }
        
        if (riskComponents.userPosition !== undefined) {
            weightedRisk += riskComponents.userPosition * weights.userPosition;
            totalWeight += weights.userPosition;
        }
        
        // Add asset type base risk (crypto = higher base risk)
        let baseRiskAdjustment = 0;
        if (marketData.assetType === 'crypto') {
            baseRiskAdjustment = 10; // Crypto is inherently more risky
        } else if (marketData.assetType === 'stock') {
            baseRiskAdjustment = 0;
        } else if (marketData.assetType === 'etf') {
            baseRiskAdjustment = -5; // ETFs generally less risky (diversified)
        }
        
        if (totalWeight === 0) return 50 + baseRiskAdjustment;
        
        const finalRisk = (weightedRisk / totalWeight) + baseRiskAdjustment;
        
        // Clamp to 0-100
        return Math.max(0, Math.min(100, Math.round(finalRisk)));
    }
    
    /**
     * Determine market regime from analysis
     */
    private determineMarketRegime(
        layerOutputs: Record<string, LayerOutput>,
        buyScore: number,
        sellScore: number
    ): MarketRegime {
        // Check trend layer
        if (layerOutputs.trend?.flags.includes('uptrend')) {
            if (buyScore > 7) return 'bull';
        }
        if (layerOutputs.trend?.flags.includes('downtrend')) {
            if (sellScore > 7) return 'bear';
        }
        
        // Use scores as fallback
        if (buyScore > sellScore + 2) return 'bull';
        if (sellScore > buyScore + 2) return 'bear';
        
        return 'range';
    }
    
    /**
     * Generate plain-English explanation
     */
    private generateExplanation(
        layerOutputs: Record<string, LayerOutput>,
        buyScore: number,
        sellScore: number,
        regime: MarketRegime,
        mode: AnalysisMode
    ): string {
        const parts: string[] = [];
        
        // Opening statement about regime
        parts.push(`Market regime: ${regime}.`);
        
        // Buy/Sell score interpretation
        if (buyScore > 7) {
            parts.push(`Strong buy signals (${buyScore.toFixed(1)}/10) suggest accumulation opportunities.`);
        } else if (buyScore > 6) {
            parts.push(`Moderate buy signals (${buyScore.toFixed(1)}/10) suggest favorable entry conditions.`);
        } else if (sellScore > 7) {
            parts.push(`Strong sell signals (${sellScore.toFixed(1)}/10) suggest caution or profit-taking.`);
        } else if (sellScore > 6) {
            parts.push(`Moderate sell signals (${sellScore.toFixed(1)}/10) suggest considering exits.`);
        } else {
            parts.push(`Mixed signals - wait for clearer direction.`);
        }
        
        // Add key insight from most relevant layer
        const trendNotes = layerOutputs.trend?.notes;
        const momentumNotes = layerOutputs.momentum?.notes;
        
        if (mode === 'long-term' && layerOutputs.fundamentals?.notes) {
            parts.push(layerOutputs.fundamentals.notes);
        } else if (trendNotes) {
            parts.push(trendNotes);
        } else if (momentumNotes) {
            parts.push(momentumNotes);
        }
        
        return parts.join(' ');
    }
    
    /**
     * Determine suggested action based on scores
     */
    private determineSuggestedAction(
        buyScore: number,
        sellScore: number,
        riskScore: number,
        userPosition?: UserPosition
    ): SuggestedAction {
        // User has position
        if (userPosition) {
            const pnlPercent = userPosition.pnlPercent;
            
            // Large profits + high sell score = take profits
            if (pnlPercent > 25 && sellScore > 6.5) {
                return 'take_full_profits';
            }
            if (pnlPercent > 10 && sellScore > 6.5) {
                return 'take_partial_profits';
            }
            
            // Large losses + high risk = consider exit
            if (pnlPercent < -20 && riskScore > 70) {
                return 'consider_exit';
            }
            
            // Strong buy signals while in position = hold or add
            if (buyScore > 7 && pnlPercent > 0) {
                return 'hold';
            }
            
            // Mixed signals = hold
            if (Math.abs(buyScore - sellScore) < 1.5) {
                return 'hold';
            }
        }
        
        // No position
        if (buyScore > 7.5 && riskScore < 60) {
            return 'accumulate_aggressive';
        }
        if (buyScore > 6.5 && riskScore < 70) {
            return 'accumulate_small';
        }
        if (sellScore > 7 || riskScore > 80) {
            return 'avoid_new_entries';
        }
        if (Math.abs(buyScore - sellScore) < 1.5) {
            return 'no_action';
        }
        
        return 'hold';
    }
    
    /**
     * Extract key factors from layer outputs
     */
    private extractKeyFactors(layerOutputs: Record<string, LayerOutput>): KeyFactor[] {
        const factors: KeyFactor[] = [];
        
        // Process each layer's flags
        for (const [layerName, output] of Object.entries(layerOutputs)) {
            for (const flag of output.flags) {
                if (flag === 'insufficient_data' || flag === 'not_applicable' || flag === 'layer_error') {
                    continue;
                }
                
                // Determine impact
                let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
                const flagLower = flag.toLowerCase();
                
                if (flagLower.includes('bullish') || flagLower.includes('uptrend') || flagLower.includes('support') || 
                    flagLower.includes('oversold') || flagLower.includes('undervalued') || flagLower.includes('growth')) {
                    impact = 'positive';
                } else if (flagLower.includes('bearish') || flagLower.includes('downtrend') || flagLower.includes('resistance') ||
                           flagLower.includes('overbought') || flagLower.includes('overvalued') || flagLower.includes('volatility') ||
                           flagLower.includes('loss')) {
                    impact = 'negative';
                }
                
                factors.push({
                    factor: this.formatFactorName(flag),
                    impact,
                    description: output.notes.split('.')[0] || flag,
                });
            }
        }
        
        // Limit to top 5 most impactful
        return factors.slice(0, 5);
    }
    
    private formatFactorName(flag: string): string {
        return flag
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Build layer breakdown object
     */
    private buildLayerBreakdown(layerOutputs: Record<string, LayerOutput>): LayerBreakdown {
        return {
            trend: layerOutputs.trend?.score || 0,
            momentum: layerOutputs.momentum?.score || 0,
            supportResistance: layerOutputs.supportResistance?.score || 0,
            volumeVolatility: layerOutputs.volumeVolatility?.score || 0,
            fundamentals: layerOutputs.fundamentals?.score || 0,
            userPosition: layerOutputs.userPosition?.score || 0,
        };
    }
}

