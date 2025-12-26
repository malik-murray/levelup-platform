/**
 * BudgetEngine - Generates monthly budgets from 90-day spend history
 * Applies profile-specific guardrails (debt payoff, saving, spend control, etc.)
 */

import { createClient } from '@supabase/supabase-js';
import { BudgetPlan, BudgetItem, BudgetPlanStatus, BudgetPlanGeneratedBy } from './types';
import { UserProfile } from './types';
import { getUserProfile } from './userProfileService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface BudgetGenerationOptions {
    userId: string;
    month: string; // YYYY-MM format
    sourceDataDays?: number; // Default: 90 days
    profileType?: string; // Override profile type
}

export interface CategorySpendSummary {
    category_id: string;
    category_name: string;
    total_spend: number;
    transaction_count: number;
    avg_monthly_spend: number; // Average over the period
}

/**
 * Gets spend summary by category for the last N days
 */
async function getCategorySpendSummary(
    userId: string,
    days: number = 90
): Promise<CategorySpendSummary[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get transactions with categories (expenses only - negative amounts)
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
            id,
            amount,
            category_id,
            categories!inner(id, name)
        `)
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lt('date', endDate.toISOString().split('T')[0])
        .lt('amount', 0) // Expenses only
        .not('category_id', 'is', null);

    if (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }

    // Group by category
    const categoryMap = new Map<string, { total: number; count: number; name: string }>();

    for (const tx of transactions || []) {
        const categoryId = tx.category_id;
        const category = (tx.categories as any)?.[0] || tx.categories;
        const categoryName = category?.name || 'Unknown';

        if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, { total: 0, count: 0, name: categoryName });
        }

        const entry = categoryMap.get(categoryId)!;
        entry.total += Math.abs(tx.amount); // Convert to positive
        entry.count += 1;
    }

    // Calculate average monthly spend
    const monthsInPeriod = days / 30;
    const summaries: CategorySpendSummary[] = [];

    for (const [categoryId, data] of categoryMap.entries()) {
        summaries.push({
            category_id: categoryId,
            category_name: data.name,
            total_spend: data.total,
            transaction_count: data.count,
            avg_monthly_spend: data.total / monthsInPeriod,
        });
    }

    return summaries.sort((a, b) => b.avg_monthly_spend - a.avg_monthly_spend);
}

/**
 * Gets income average for the last N days
 */
async function getAverageMonthlyIncome(userId: string, days: number = 90): Promise<number> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lt('date', endDate.toISOString().split('T')[0])
        .gt('amount', 0); // Income only

    if (error) {
        console.error('Error fetching income:', error);
        return 0;
    }

    const totalIncome = (transactions || []).reduce((sum, tx) => sum + tx.amount, 0);
    const monthsInPeriod = days / 30;
    return totalIncome / monthsInPeriod;
}

/**
 * Applies guardrails to budget amounts based on profile type
 */
function applyGuardrails(
    categorySpend: number,
    totalIncome: number,
    profile: UserProfile | null
): { adjustedAmount: number; guardrailReason: string | null } {
    if (!profile || !profile.guardrails) {
        // No profile or guardrails - use raw spend
        return { adjustedAmount: categorySpend, guardrailReason: null };
    }

    const guardrails = profile.guardrails;
    let adjustedAmount = categorySpend;
    let reason: string | null = null;

    switch (profile.profile_type) {
        case 'debt_payoff': {
            // Emphasize minimum payments, reduce discretionary spending
            const maxDiscretionary = (guardrails.max_discretionary_spending as number) || 0.3;
            const discretionaryCategories = ['Entertainment', 'Dining', 'Shopping', 'Hobbies'];

            // Check if this is a discretionary category (simplified - should check category name)
            const isDiscretionary = false; // TODO: Check category name/group

            if (isDiscretionary) {
                adjustedAmount = categorySpend * (maxDiscretionary * 0.8); // Reduce discretionary by 20%
                reason = 'Debt payoff: Reduced discretionary spending';
            }
            break;
        }

        case 'saving_focused': {
            // Emphasize sinking funds, maintain essential spending
            const minSavingsRate = (guardrails.minimum_savings_rate as number) || 0.2;
            const essentialCategories = ['Housing', 'Food', 'Transportation', 'Utilities'];

            const isEssential = false; // TODO: Check category name/group

            if (!isEssential && adjustedAmount > totalIncome * 0.05) {
                // Cap non-essential categories at 5% of income each
                adjustedAmount = Math.min(adjustedAmount, totalIncome * 0.05);
                reason = 'Saving focused: Capped non-essential spending';
            }
            break;
        }

        case 'spend_control': {
            // Strict category limits
            const maxDiscretionary = (guardrails.max_discretionary_spending as number) || 0.4;
            
            // Cap at 10% increase from average
            const maxIncrease = categorySpend * 1.1;
            adjustedAmount = Math.min(adjustedAmount, maxIncrease);
            reason = 'Spend control: Limited to 10% increase';
            break;
        }

        case 'rebuild_credit': {
            // Prioritize bills, reduce unnecessary spending
            const essentialCategories = ['Housing', 'Food', 'Transportation', 'Utilities', 'Debt Payment'];

            const isEssential = false; // TODO: Check category name/group

            if (!isEssential) {
                adjustedAmount = categorySpend * 0.9; // Reduce by 10%
                reason = 'Rebuild credit: Reduced non-essential spending';
            }
            break;
        }

        case 'investing_focused': {
            // Maintain essential, optimize for investment
            // Similar to saving focused
            break;
        }

        default:
            // Mixed profile - no specific adjustments
            break;
    }

    return { adjustedAmount, guardrailReason: reason };
}

/**
 * Generates a budget plan for a given month
 */
export async function generateBudgetPlan(
    options: BudgetGenerationOptions
): Promise<BudgetPlan & { items: BudgetItem[] }> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const sourceDataDays = options.sourceDataDays || 90;
    const userId = options.userId;

    // Get user profile
    const profile = options.profileType 
        ? { profile_type: options.profileType, guardrails: {}, preferences: {}, budget_strategy: 'zero_based' } as UserProfile
        : await getUserProfile(userId);

    // Get spend summary and income
    const [categorySpends, avgIncome] = await Promise.all([
        getCategorySpendSummary(userId, sourceDataDays),
        getAverageMonthlyIncome(userId, sourceDataDays),
    ]);

    // Calculate start and end dates for source data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - sourceDataDays);

    // Deactivate existing active budget for this month
    await supabase
        .from('budget_plans')
        .update({ status: 'archived' })
        .eq('user_id', userId)
        .eq('month', options.month)
        .eq('status', 'active');

    // Create budget plan
    const { data: budgetPlan, error: planError } = await supabase
        .from('budget_plans')
        .insert({
            user_id: userId,
            month: options.month,
            generated_by: 'auto' as BudgetPlanGeneratedBy,
            source_data_start_date: startDate.toISOString().split('T')[0],
            source_data_end_date: endDate.toISOString().split('T')[0],
            profile_type: profile?.profile_type || null,
            status: 'active' as BudgetPlanStatus,
            metadata: {
                avg_monthly_income: avgIncome,
                categories_included: categorySpends.length,
            },
        })
        .select()
        .single();

    if (planError) {
        throw new Error(`Failed to create budget plan: ${planError.message}`);
    }

    // Create budget items with guardrails
    const budgetItems: BudgetItem[] = [];

    for (const categorySpend of categorySpends) {
        const { adjustedAmount, guardrailReason } = applyGuardrails(
            categorySpend.avg_monthly_spend,
            avgIncome,
            profile
        );

        const { data: budgetItem, error: itemError } = await supabase
            .from('budget_items')
            .insert({
                budget_plan_id: budgetPlan.id,
                category_id: categorySpend.category_id,
                amount: adjustedAmount,
                guardrail_adjustment: adjustedAmount - categorySpend.avg_monthly_spend,
                guardrail_reason: guardrailReason,
                user_override_amount: null,
                user_override_reason: null,
            })
            .select()
            .single();

        if (!itemError && budgetItem) {
            budgetItems.push(budgetItem as BudgetItem);
        }
    }

    return {
        ...(budgetPlan as BudgetPlan),
        items: budgetItems,
    };
}

/**
 * Gets active budget plan for a month
 */
export async function getActiveBudgetPlan(
    userId: string,
    month: string
): Promise<(BudgetPlan & { items: BudgetItem[] }) | null> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const { data: budgetPlan, error } = await supabase
        .from('budget_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('status', 'active')
        .single();

    if (error || !budgetPlan) {
        return null;
    }

    const { data: budgetItems } = await supabase
        .from('budget_items')
        .select('*')
        .eq('budget_plan_id', budgetPlan.id);

    return {
        ...(budgetPlan as BudgetPlan),
        items: (budgetItems || []) as BudgetItem[],
    };
}


