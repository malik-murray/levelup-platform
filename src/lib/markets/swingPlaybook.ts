/**
 * Swing Trading Playbook
 * Converts Buy/Sell/Risk scores into human-readable trading tiers and actions
 */

import { AnalysisResult } from './types';

/**
 * Configurable thresholds for Swing mode playbook
 * Easy to tweak without changing core logic
 */
export interface SwingPlaybookConfig {
    // Buy score thresholds (0-10 scale)
    strongBuyThreshold: number;      // e.g., 8.0 - Buy score must be >= this for Strong Buy
    buyThreshold: number;             // e.g., 6.5 - Buy score must be >= this for Buy
    
    // Sell score thresholds (0-10 scale)
    strongSellThreshold: number;      // e.g., 8.0 - Sell score must be >= this for Strong Sell
    takeProfitThreshold: number;      // e.g., 6.5 - Sell score must be >= this for Take Profit
    
    // Risk score thresholds (0-100 scale)
    highRiskThreshold: number;        // e.g., 70 - Risk score must be >= this to be High-Risk Avoid
    
    // Score differences for edge cases
    neutralThreshold: number;         // e.g., 1.0 - If Buy/Sell scores are within this, it's Neutral
}

/**
 * Default configuration - easy to adjust
 */
export const DEFAULT_SWING_PLAYBOOK_CONFIG: SwingPlaybookConfig = {
    strongBuyThreshold: 8.0,
    buyThreshold: 6.5,
    strongSellThreshold: 8.0,
    takeProfitThreshold: 6.5,
    highRiskThreshold: 70,
    neutralThreshold: 1.0,
};

/**
 * Playbook tier types
 */
export type PlaybookTier = 
    | 'Strong Buy'
    | 'Buy'
    | 'Neutral'
    | 'Take Profit'
    | 'Strong Sell'
    | 'High-Risk Avoid';

/**
 * Playbook result with tier and action
 */
export interface PlaybookResult {
    tier: PlaybookTier;
    action: string;
    reasoning: string;
}

/**
 * Get human-readable action based on tier
 */
function getActionForTier(tier: PlaybookTier, analysis: AnalysisResult): string {
    const ticker = analysis.ticker;
    
    switch (tier) {
        case 'Strong Buy':
            return 'Buy a small position on this dip';
        case 'Buy':
            return 'Consider adding to your position or opening a new one';
        case 'Neutral':
            return 'Wait for a clearer signal before taking action';
        case 'Take Profit':
            if (analysis.marketRegime === 'bull') {
                return 'Consider taking partial profits while trend remains strong';
            }
            return 'Consider taking partial profits and tightening stops';
        case 'Strong Sell':
            return 'Consider exiting or significantly reducing position';
        case 'High-Risk Avoid':
            return 'High volatility and risk - avoid new positions';
        default:
            return 'Monitor closely for entry/exit signals';
    }
}

/**
 * Get reasoning for the tier decision
 */
function getReasoning(tier: PlaybookTier, analysis: AnalysisResult): string {
    const buyScore = analysis.buyScore.toFixed(1);
    const sellScore = analysis.sellScore.toFixed(1);
    const riskScore = analysis.riskScore.toFixed(0);
    const regime = analysis.marketRegime;
    
    switch (tier) {
        case 'Strong Buy':
            return `Strong buy signal (${buyScore}/10) in ${regime} market. Risk: ${riskScore}/100`;
        case 'Buy':
            return `Buy signal (${buyScore}/10) with moderate risk (${riskScore}/100)`;
        case 'Neutral':
            return `Mixed signals - Buy: ${buyScore}/10, Sell: ${sellScore}/10. Risk: ${riskScore}/100`;
        case 'Take Profit':
            return `Sell signal (${sellScore}/10) suggests taking profits. Risk: ${riskScore}/100`;
        case 'Strong Sell':
            return `Strong sell signal (${sellScore}/10) in ${regime} market. Risk: ${riskScore}/100`;
        case 'High-Risk Avoid':
            return `High risk (${riskScore}/100) outweighs any potential signals. Buy: ${buyScore}/10, Sell: ${sellScore}/10`;
        default:
            return `Buy: ${buyScore}/10, Sell: ${sellScore}/10, Risk: ${riskScore}/100`;
    }
}

/**
 * Determine playbook tier based on analysis scores
 */
export function getSwingPlaybookTier(
    analysis: AnalysisResult,
    config: SwingPlaybookConfig = DEFAULT_SWING_PLAYBOOK_CONFIG
): PlaybookResult {
    const { buyScore, sellScore, riskScore } = analysis;
    
    // High-Risk Avoid takes priority - if risk is too high, avoid regardless of signals
    if (riskScore >= config.highRiskThreshold) {
        return {
            tier: 'High-Risk Avoid',
            action: getActionForTier('High-Risk Avoid', analysis),
            reasoning: getReasoning('High-Risk Avoid', analysis),
        };
    }
    
    // Calculate score difference to determine if signals are conflicting
    const scoreDiff = Math.abs(buyScore - sellScore);
    
    // If scores are very close, it's Neutral
    if (scoreDiff <= config.neutralThreshold) {
        return {
            tier: 'Neutral',
            action: getActionForTier('Neutral', analysis),
            reasoning: getReasoning('Neutral', analysis),
        };
    }
    
    // Strong Buy: High buy score, low sell score
    if (buyScore >= config.strongBuyThreshold && sellScore < config.takeProfitThreshold) {
        return {
            tier: 'Strong Buy',
            action: getActionForTier('Strong Buy', analysis),
            reasoning: getReasoning('Strong Buy', analysis),
        };
    }
    
    // Buy: Moderate buy score, low sell score
    if (buyScore >= config.buyThreshold && sellScore < config.takeProfitThreshold) {
        return {
            tier: 'Buy',
            action: getActionForTier('Buy', analysis),
            reasoning: getReasoning('Buy', analysis),
        };
    }
    
    // Strong Sell: High sell score, low buy score
    if (sellScore >= config.strongSellThreshold && buyScore < config.buyThreshold) {
        return {
            tier: 'Strong Sell',
            action: getActionForTier('Strong Sell', analysis),
            reasoning: getReasoning('Strong Sell', analysis),
        };
    }
    
    // Take Profit: Moderate sell score, low buy score
    if (sellScore >= config.takeProfitThreshold && buyScore < config.buyThreshold) {
        return {
            tier: 'Take Profit',
            action: getActionForTier('Take Profit', analysis),
            reasoning: getReasoning('Take Profit', analysis),
        };
    }
    
    // Default to Neutral if no clear signal
    return {
        tier: 'Neutral',
        action: getActionForTier('Neutral', analysis),
        reasoning: getReasoning('Neutral', analysis),
    };
}

/**
 * Get color scheme for tier badge
 */
export function getTierColor(tier: PlaybookTier): {
    bg: string;
    text: string;
    border: string;
} {
    switch (tier) {
        case 'Strong Buy':
            return {
                bg: 'bg-green-50 dark:bg-green-900/20',
                text: 'text-green-800 dark:text-green-300',
                border: 'border-green-200 dark:border-green-800',
            };
        case 'Buy':
            return {
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                text: 'text-emerald-800 dark:text-emerald-300',
                border: 'border-emerald-200 dark:border-emerald-800',
            };
        case 'Neutral':
            return {
                bg: 'bg-slate-50 dark:bg-slate-900/20',
                text: 'text-slate-800 dark:text-slate-300',
                border: 'border-slate-200 dark:border-slate-800',
            };
        case 'Take Profit':
            return {
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                text: 'text-amber-800 dark:text-amber-300',
                border: 'border-amber-200 dark:border-amber-800',
            };
        case 'Strong Sell':
            return {
                bg: 'bg-red-50 dark:bg-red-900/20',
                text: 'text-red-800 dark:text-red-300',
                border: 'border-red-200 dark:border-red-800',
            };
        case 'High-Risk Avoid':
            return {
                bg: 'bg-orange-50 dark:bg-orange-900/20',
                text: 'text-orange-800 dark:text-orange-300',
                border: 'border-orange-200 dark:border-orange-800',
            };
    }
}





