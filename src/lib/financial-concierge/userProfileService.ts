/**
 * Service for deriving user profile from survey responses
 */

import { UserSurvey, UserProfile, UserProfileType, BudgetStrategy } from './types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Derives user profile type from survey responses
 */
export function deriveProfileType(survey: UserSurvey): UserProfileType {
    // Count active goals
    const activeGoals = [
        survey.goal_debt_payoff,
        survey.goal_saving,
        survey.goal_investing,
        survey.goal_spend_control,
        survey.goal_rebuild_credit,
        survey.goal_buy_house,
        survey.goal_buy_car,
    ].filter(Boolean).length;

    // Single primary goal takes precedence
    if (survey.goal_debt_payoff && activeGoals === 1) {
        return 'debt_payoff';
    }
    if (survey.goal_saving && activeGoals === 1) {
        return 'saving_focused';
    }
    if (survey.goal_investing && activeGoals === 1) {
        return 'investing_focused';
    }
    if (survey.goal_spend_control && activeGoals === 1) {
        return 'spend_control';
    }
    if (survey.goal_rebuild_credit && activeGoals === 1) {
        return 'rebuild_credit';
    }

    // Multiple goals = mixed profile
    return 'mixed';
}

/**
 * Derives budget strategy from profile type and survey
 */
export function deriveBudgetStrategy(
    profileType: UserProfileType,
    survey: UserSurvey
): BudgetStrategy {
    // Debt payoff profiles benefit from zero-based budgeting
    if (profileType === 'debt_payoff') {
        return 'zero_based';
    }

    // Spend control benefits from envelope method
    if (profileType === 'spend_control') {
        return 'envelope';
    }

    // Saving focused can use 50-30-20 rule
    if (profileType === 'saving_focused') {
        return '50_30_20';
    }

    // Default to zero-based
    return 'zero_based';
}

/**
 * Generates guardrails based on profile type and survey
 */
export function generateGuardrails(
    profileType: UserProfileType,
    survey: UserSurvey
): Record<string, any> {
    const guardrails: Record<string, any> = {};

    switch (profileType) {
        case 'debt_payoff':
            guardrails.minimum_payment_priority = true;
            guardrails.avalanche_method = survey.debt_payoff_strategy === 'avalanche';
            guardrails.snowball_method = survey.debt_payoff_strategy === 'snowball';
            guardrails.max_discretionary_spending = 0.3; // 30% max discretionary
            guardrails.emergency_fund_minimum = 1000; // $1000 minimum emergency fund
            break;

        case 'saving_focused':
            guardrails.minimum_savings_rate = 0.2; // 20% minimum savings
            guardrails.sinking_fund_priority = true;
            guardrails.max_discretionary_spending = 0.5; // 50% max discretionary
            if (survey.target_savings_amount) {
                guardrails.target_savings_amount = survey.target_savings_amount;
                guardrails.target_timeline_months = survey.target_savings_timeline_months || 12;
            }
            break;

        case 'investing_focused':
            guardrails.minimum_savings_rate = 0.15; // 15% minimum savings
            guardrails.investment_priority = true;
            guardrails.emergency_fund_minimum = survey.household_size * 500; // $500 per household member
            break;

        case 'spend_control':
            guardrails.strict_category_limits = true;
            guardrails.max_discretionary_spending = 0.4; // 40% max discretionary
            guardrails.require_approval_for_overages = true;
            break;

        case 'rebuild_credit':
            guardrails.priority_pay_bills_on_time = true;
            guardrails.credit_utilization_target = 0.3; // 30% max utilization
            guardrails.avoid_new_debt = true;
            break;

        case 'mixed':
            // Balanced approach
            guardrails.minimum_savings_rate = 0.1; // 10% minimum savings
            guardrails.max_discretionary_spending = 0.5;
            break;
    }

    // Risk tolerance adjustments
    if (survey.risk_tolerance === 'conservative') {
        guardrails.conservative_investments_only = true;
        guardrails.higher_emergency_fund = true;
    } else if (survey.risk_tolerance === 'aggressive') {
        guardrails.aggressive_investment_allocation = true;
        guardrails.lower_emergency_fund_threshold = true;
    }

    // Income stability adjustments
    if (survey.income_stability === 'variable' || survey.income_stability === 'unstable') {
        guardrails.higher_emergency_fund_multiplier = 6; // 6 months expenses
        guardrails.conservative_budgeting = true;
    } else {
        guardrails.emergency_fund_multiplier = 3; // 3 months expenses
    }

    return guardrails;
}

/**
 * Creates or updates user profile from survey
 */
export async function createOrUpdateUserProfile(
    userId: string,
    survey: UserSurvey,
    authenticatedSupabase?: SupabaseClient<any, 'public', any>
): Promise<UserProfile> {
    // Use provided authenticated client or create a new one (for backward compatibility)
    const supabase = authenticatedSupabase || createClient(supabaseUrl, supabaseAnonKey);

    const profileType = deriveProfileType(survey);
    const budgetStrategy = deriveBudgetStrategy(profileType, survey);
    const guardrails = generateGuardrails(profileType, survey);

    // Check if profile exists
    const { data: existingProfile } = await supabase
        .from('user_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

    const profileData = {
        user_id: userId,
        profile_type: profileType,
        budget_strategy: budgetStrategy,
        guardrails,
        preferences: {}, // Can be extended later
    };

    let profile: UserProfile;

    if (existingProfile) {
        // Update existing profile
        const { data, error } = await supabase
            .from('user_profile')
            .update(profileData)
            .eq('id', existingProfile.id)
            .select()
            .single();

        if (error) throw error;
        profile = data as UserProfile;
    } else {
        // Create new profile
        const { data, error } = await supabase
            .from('user_profile')
            .insert(profileData)
            .select()
            .single();

        if (error) throw error;
        profile = data as UserProfile;
    }

    return profile;
}

/**
 * Gets user profile (or creates default if none exists)
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase
        .from('user_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Not found - return null
            return null;
        }
        throw error;
    }

    return data as UserProfile;
}

