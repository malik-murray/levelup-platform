/**
 * Signal Logger
 * Handles logging analysis results to the database
 */

import { AnalysisResult } from './types';
import { getModeConfig } from './modes';

/**
 * Logger interface for signal logging
 * Can be implemented with Supabase or other storage
 */
export interface SignalLogger {
    log(result: AnalysisResult): Promise<void>;
}

/**
 * Create a Supabase-based signal logger that fetches userId dynamically
 * This function returns a logger that can be passed to SignalEngine
 */
export function createSupabaseLogger(supabaseClient: any): SignalLogger {
    return {
        async log(result: AnalysisResult): Promise<void> {
            try {
                // Fetch userId dynamically (returns null if not authenticated)
                const { data: { user } } = await supabaseClient.auth.getUser();
                const userId = user?.id || null;

                const modeConfig = getModeConfig(result.mode);

                await supabaseClient.from('market_signal_logs').insert({
                    user_id: userId, // null for system-wide logs or unauthenticated
                    ticker: result.ticker,
                    asset_type: result.assetType,
                    mode: result.mode,
                    timestamp: new Date(result.timestamp).toISOString(),
                    buy_score: result.buyScore,
                    sell_score: result.sellScore,
                    risk_score: result.riskScore,
                    market_regime: result.marketRegime,
                    current_price: result.currentPrice,
                    explanation: result.explanation,
                    suggested_action: result.suggestedAction,
                    layer_breakdown: result.layerBreakdown,
                    layer_outputs: result.layerOutputs,
                    inputs: {
                        timeframes: modeConfig.timeframes,
                        weights: modeConfig.weights,
                    },
                });
            } catch (error) {
                // Log errors but don't throw - logging shouldn't break analysis
                console.error('Error logging signal to database:', error);
            }
        },
    };
}

/**
 * No-op logger for testing or when logging is disabled
 */
export const noOpLogger: SignalLogger = {
    async log() {
        // Do nothing
    },
};

