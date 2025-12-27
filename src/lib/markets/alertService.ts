/**
 * Market Alert Service
 * Handles creating alerts when tier changes occur (e.g., Strong Buy / Strong Sell)
 */

import { AnalysisResult } from './types';
import { getSwingPlaybookTier, PlaybookTier } from './swingPlaybook';
import { supabase } from '@auth/supabaseClient';

/**
 * Check if a tier should trigger an alert
 */
function shouldAlertForTier(tier: PlaybookTier): boolean {
    return tier === 'Strong Buy' || tier === 'Strong Sell';
}

/**
 * Check if user has ETH swing alerts enabled
 */
async function isEthSwingAlertsEnabled(userId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('market_user_settings')
            .select('eth_swing_alerts_enabled')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error checking ETH swing alerts setting:', error);
            return false;
        }

        return data?.eth_swing_alerts_enabled === true;
    } catch (error) {
        console.error('Error checking ETH swing alerts setting:', error);
        return false;
    }
}

/**
 * Check if we should create an alert for this analysis
 * Only creates alerts when:
 * 1. User has ETH swing alerts enabled
 * 2. Ticker is ETH or ETH-USD
 * 3. Mode is swing
 * 4. Tier is Strong Buy or Strong Sell
 * 5. We haven't already created an alert for this tier in the last hour (to avoid spam)
 */
async function shouldCreateAlert(
    analysis: AnalysisResult,
    userId: string
): Promise<boolean> {
    // Only for ETH in swing mode
    const isEth = analysis.ticker === 'ETH' || analysis.ticker === 'ETH-USD';
    if (!isEth || analysis.mode !== 'swing') {
        return false;
    }

    // Check if user has alerts enabled
    const alertsEnabled = await isEthSwingAlertsEnabled(userId);
    if (!alertsEnabled) {
        return false;
    }

    // Check tier
    const playbookResult = getSwingPlaybookTier(analysis);
    if (!shouldAlertForTier(playbookResult.tier)) {
        return false;
    }

    // Check if we've already created an alert for this tier recently (within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
        .from('market_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('ticker', analysis.ticker)
        .eq('tier', playbookResult.tier)
        .gte('created_at', oneHourAgo)
        .limit(1);

    // If we already have a recent alert for this tier, don't create another one
    if (recentAlerts && recentAlerts.length > 0) {
        return false;
    }

    return true;
}

/**
 * Create an alert for a tier change
 */
export async function createAlertIfNeeded(
    analysis: AnalysisResult,
    userId: string | null
): Promise<void> {
    if (!userId) {
        return; // Can't create alerts without a user
    }

    try {
        const shouldCreate = await shouldCreateAlert(analysis, userId);
        if (!shouldCreate) {
            return;
        }

        const playbookResult = getSwingPlaybookTier(analysis);

        const { error } = await supabase.from('market_alerts').insert({
            user_id: userId,
            ticker: analysis.ticker,
            tier: playbookResult.tier,
            buy_score: analysis.buyScore,
            sell_score: analysis.sellScore,
            risk_score: analysis.riskScore,
            market_regime: analysis.marketRegime,
            current_price: analysis.currentPrice,
            read: false,
        });

        if (error) {
            console.error('Error creating alert:', error);
        } else {
            console.log(`Alert created for ${analysis.ticker}: ${playbookResult.tier}`);
        }
    } catch (error) {
        console.error('Error in createAlertIfNeeded:', error);
    }
}










