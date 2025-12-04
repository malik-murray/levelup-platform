/**
 * User Position Data Layer
 * Analyzes user's existing position and provides personalized suggestions
 */

import { BaseDataLayer } from './base';
import { LayerInput, LayerOutput, AnalysisMode } from '../types';

export class UserPositionLayer extends BaseDataLayer {
    name = 'userPosition';
    
    isApplicable(mode: AnalysisMode): boolean {
        return true; // Always applicable if user has a position
    }
    
    async analyze(input: LayerInput): Promise<LayerOutput> {
        const { userPosition, marketData } = input;
        
        // If no position, return neutral
        if (!userPosition) {
            return {
                score: 5,
                flags: ['no_position'],
                notes: 'No existing position tracked for this asset.',
            };
        }
        
        const { pnlPercent, averageEntry, currentPrice } = userPosition;
        const distanceFromEntry = (currentPrice - averageEntry) / averageEntry;
        
        let score = 5;
        const flags: string[] = [];
        
        // Large profits suggest taking some profits
        if (pnlPercent > 50) {
            flags.push('large_profit', 'consider_taking_profits');
            score -= 2; // Suggests selling/trimming
        } else if (pnlPercent > 25) {
            flags.push('significant_profit', 'consider_partial_profits');
            score -= 1;
        } else if (pnlPercent > 10) {
            flags.push('moderate_profit');
        }
        
        // Large losses - depends on context
        if (pnlPercent < -30) {
            flags.push('large_loss', 'consider_exit_or_average_down');
            // Neutral score - could be buy more or exit, depends on other factors
        } else if (pnlPercent < -15) {
            flags.push('significant_loss');
        }
        
        // Near entry price
        if (Math.abs(distanceFromEntry) < 0.02) {
            flags.push('near_entry_price');
        }
        
        // Risk tolerance consideration
        if (userPosition.riskTolerance === 'low' && Math.abs(pnlPercent) > 20) {
            flags.push('risk_tolerance_exceeded');
            if (pnlPercent > 20) {
                score -= 1.5; // Take profits for low risk tolerance
            }
        }
        
        const notes = this.generateNotes(userPosition, distanceFromEntry);
        
        return {
            score: this.normalizeScore(score, 0, 10),
            flags,
            notes,
            metadata: {
                pnlPercent,
                averageEntry,
                currentPrice,
                distanceFromEntry,
            },
        };
    }
    
    private generateNotes(position: { pnlPercent: number; averageEntry: number; currentPrice: number }, distanceFromEntry: number): string {
        if (position.pnlPercent > 25) {
            return `You're up ${position.pnlPercent.toFixed(1)}% from your entry at $${position.averageEntry.toFixed(2)}. Consider taking partial profits to lock in gains.`;
        } else if (position.pnlPercent > 10) {
            return `You're up ${position.pnlPercent.toFixed(1)}% from your entry. Position is performing well. Consider your profit-taking strategy.`;
        } else if (position.pnlPercent < -20) {
            return `You're down ${Math.abs(position.pnlPercent).toFixed(1)}% from your entry at $${position.averageEntry.toFixed(2)}. Review your strategy and risk management.`;
        } else if (position.pnlPercent < -10) {
            return `You're down ${Math.abs(position.pnlPercent).toFixed(1)}% from your entry. Monitor closely and consider your exit strategy.`;
        } else {
            return `Position is near entry price. Current price: $${position.currentPrice.toFixed(2)}, Entry: $${position.averageEntry.toFixed(2)}.`;
        }
    }
}

