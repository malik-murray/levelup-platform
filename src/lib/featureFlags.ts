/**
 * Feature Flags - Feature gating hooks for paid tiers
 * Note: This is a simple implementation without pricing enforcement yet
 */

export type FeatureTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface FeatureFlags {
    conciergeAutoCategorization: boolean;
    conciergeBudgetGeneration: boolean;
    conciergeInsights: boolean;
    conciergeRecommendations: boolean;
    conciergeMLCategorization: boolean;
    conciergeAdvancedReports: boolean;
    conciergeUnlimitedStatements: boolean;
    conciergePrioritySupport: boolean;
}

/**
 * Feature flag definitions per tier
 */
const FEATURE_FLAGS_BY_TIER: Record<FeatureTier, FeatureFlags> = {
    free: {
        conciergeAutoCategorization: false,
        conciergeBudgetGeneration: false,
        conciergeInsights: false,
        conciergeRecommendations: false,
        conciergeMLCategorization: false,
        conciergeAdvancedReports: false,
        conciergeUnlimitedStatements: false,
        conciergePrioritySupport: false,
    },
    basic: {
        conciergeAutoCategorization: true,
        conciergeBudgetGeneration: true,
        conciergeInsights: true,
        conciergeRecommendations: true,
        conciergeMLCategorization: false,
        conciergeAdvancedReports: false,
        conciergeUnlimitedStatements: false,
        conciergePrioritySupport: false,
    },
    premium: {
        conciergeAutoCategorization: true,
        conciergeBudgetGeneration: true,
        conciergeInsights: true,
        conciergeRecommendations: true,
        conciergeMLCategorization: true,
        conciergeAdvancedReports: true,
        conciergeUnlimitedStatements: true,
        conciergePrioritySupport: false,
    },
    enterprise: {
        conciergeAutoCategorization: true,
        conciergeBudgetGeneration: true,
        conciergeInsights: true,
        conciergeRecommendations: true,
        conciergeMLCategorization: true,
        conciergeAdvancedReports: true,
        conciergeUnlimitedStatements: true,
        conciergePrioritySupport: true,
    },
};

/**
 * Gets user's feature tier (for now, defaults to basic for testing)
 * TODO: Implement actual user tier lookup from database/user profile
 */
export async function getUserTier(userId?: string): Promise<FeatureTier> {
    // For now, return 'basic' as default
    // In production, this would fetch from user profile/subscription table
    return 'basic';
}

/**
 * Gets feature flags for a user
 */
export async function getUserFeatureFlags(userId?: string): Promise<FeatureFlags> {
    const tier = await getUserTier(userId);
    return FEATURE_FLAGS_BY_TIER[tier];
}

/**
 * Checks if a specific feature is enabled for a user
 */
export async function isFeatureEnabled(
    feature: keyof FeatureFlags,
    userId?: string
): Promise<boolean> {
    const flags = await getUserFeatureFlags(userId);
    return flags[feature];
}

/**
 * React hook for feature flags (client-side)
 * Note: In production, these should be fetched from API
 */
export function useFeatureFlags(userId?: string): FeatureFlags {
    // For client-side, we'll default to basic tier
    // In production, this would fetch from API on mount
    return FEATURE_FLAGS_BY_TIER['basic'];
}





