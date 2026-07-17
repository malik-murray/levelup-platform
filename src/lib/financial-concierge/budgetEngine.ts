/**
 * BudgetEngine - Generates monthly budgets from 90-day spend history
 * Applies profile-specific guardrails (debt payoff, saving, spend control, etc.)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BudgetPlan, BudgetItem, BudgetPlanStatus, BudgetPlanGeneratedBy } from './types';
import { UserProfile } from './types';
import { getUserProfile } from './userProfileService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Server-only module (cron jobs + already-authorized API routes, no end-user session).
// Service role is required so RLS doesn't block reads/writes, same pattern as
// transactionSyncService.ts.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

function getServiceClient() {
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });
}

export interface BudgetGenerationOptions {
    userId: string;
    month: string; // YYYY-MM format
    sourceDataDays?: number; // Default: 180 days (~6 months)
    profileType?: string; // Override profile type
}

// Category/group names used to classify spend for guardrail purposes. The live `categories`
// table is mostly flat (few categories actually have a parent group), so this matches on
// whichever name getCategoryGroupNames() resolves to - the group name if the category has
// one, otherwise the category's own name.
const ESSENTIAL_GROUPS = new Set([
    'Housing',
    'Rent/Mortgage',
    'Debt Payment',
    'Loan Payment',
    'Credit Card Payment',
    'Utilities',
    'Insurance',
    'Health Insurance',
    'Healthcare',
    'Pharmacy',
    'Doctor Visits',
    'Transportation',
    'Public Transit',
    'Gas',
    'Car',
    'Parking',
    'Phone Bill',
    'Child Support',
    'Home Maintenance',
    'Fees & Taxes',
    'Food & Dining', // group name for Groceries
    // Unknown spend - don't guardrail-cut something we can't classify
    'Needs Review',
    'Uncategorized',
]);
const PROTECTED_GROUPS = new Set(['Savings', 'Savings/Investing']);

/**
 * Finds a leaf category to attach an explicit savings/investing goal budget line to
 * (under a "Savings"/"Savings/Investing" group). Prefers a user-owned category named
 * "Investments" as a general catch-all, falling back to the first leaf under that group.
 */
async function resolveSavingsGoalCategoryId(supabase: any, userId: string): Promise<string | null> {
    const { data: userGroups } = await supabase
        .from('categories')
        .select('id, name')
        .eq('kind', 'group')
        .eq('user_id', userId);

    let group = (userGroups || []).find((g: any) => /saving|invest/i.test(g.name));

    if (!group) {
        const { data: globalGroups } = await supabase
            .from('categories')
            .select('id, name')
            .eq('kind', 'group')
            .is('user_id', null);
        group = (globalGroups || []).find((g: any) => /saving|invest/i.test(g.name));
    }

    if (!group) return null;

    const { data: leaves } = await supabase
        .from('categories')
        .select('id, name')
        .eq('parent_id', group.id)
        .eq('kind', 'category');

    if (!leaves || leaves.length === 0) return null;

    return (leaves.find((c: any) => c.name === 'Investments') || leaves[0]).id;
}

/**
 * Maps category_id -> parent group name for a set of categories, so guardrails can tell
 * essential/protected spend apart from discretionary spend.
 */
async function getCategoryGroupNames(
    supabase: any,
    categoryIds: string[]
): Promise<Map<string, string>> {
    const groupByCategoryId = new Map<string, string>();
    if (categoryIds.length === 0) return groupByCategoryId;

    const { data: categories } = await supabase
        .from('categories')
        .select('id, name, parent_id')
        .in('id', categoryIds);

    const parentIds = Array.from(
        new Set((categories || []).map((c: any) => c.parent_id).filter(Boolean))
    );

    const { data: parents } = parentIds.length
        ? await supabase.from('categories').select('id, name').in('id', parentIds)
        : { data: [] as any[] };

    const parentNameById = new Map((parents || []).map((p: any) => [p.id, p.name as string]));

    for (const category of (categories || []) as any[]) {
        const groupName = category.parent_id
            ? parentNameById.get(category.parent_id) || category.name
            : category.name;
        groupByCategoryId.set(category.id, groupName);
    }

    return groupByCategoryId;
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
    days: number = 180
): Promise<CategorySpendSummary[]> {
    const supabase = getServiceClient();

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
        .eq('is_transfer', false) // Exclude money moved between the user's own accounts
        .is('removed_at', null) // Exclude Plaid-removed / retired-item transactions
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
async function getAverageMonthlyIncome(userId: string, days: number = 180): Promise<number> {
    const supabase = getServiceClient();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lt('date', endDate.toISOString().split('T')[0])
        .gt('amount', 0) // Income only
        .eq('is_transfer', false) // Exclude money moved between the user's own accounts
        .is('removed_at', null); // Exclude Plaid-removed / retired-item transactions

    if (error) {
        console.error('Error fetching income:', error);
        return 0;
    }

    const totalIncome = (transactions || []).reduce((sum, tx) => sum + tx.amount, 0);
    const monthsInPeriod = days / 30;
    return totalIncome / monthsInPeriod;
}

/**
 * Applies guardrails to budget amounts based on profile type and the category's group
 * (essential / protected-for-savings / discretionary — see ESSENTIAL_GROUPS/PROTECTED_GROUPS).
 */
function applyGuardrails(
    categorySpend: number,
    totalIncome: number,
    profile: UserProfile | null,
    categoryGroupName: string
): { adjustedAmount: number; guardrailReason: string | null } {
    if (!profile || !profile.guardrails) {
        // No profile or guardrails - use raw spend
        return { adjustedAmount: categorySpend, guardrailReason: null };
    }

    const isEssential = ESSENTIAL_GROUPS.has(categoryGroupName);
    const isProtected = PROTECTED_GROUPS.has(categoryGroupName); // e.g. Savings — never cut

    if (isProtected) {
        // Savings/investing categories are the goal itself - never guardrail them down.
        return { adjustedAmount: categorySpend, guardrailReason: null };
    }

    const guardrails = profile.guardrails;
    let adjustedAmount = categorySpend;
    let reason: string | null = null;

    switch (profile.profile_type) {
        case 'debt_payoff': {
            // Emphasize minimum payments, reduce discretionary spending
            const maxDiscretionary = (guardrails.max_discretionary_spending as number) || 0.3;

            if (!isEssential) {
                adjustedAmount = categorySpend * (maxDiscretionary * 0.8); // Reduce discretionary by 20%
                reason = 'Debt payoff: Reduced discretionary spending';
            }
            break;
        }

        case 'saving_focused':
        case 'investing_focused':
        case 'mixed': {
            // Saving/investing goals: cap non-essential categories so more income is left
            // over for the Savings group. 'mixed' covers users who selected both saving and
            // investing goals (no single-goal profile applies), so it gets the same guardrail.
            const minSavingsRate = (guardrails.minimum_savings_rate as number) || 0.1;
            const capRate = Math.max(0.05, 0.5 - minSavingsRate); // more aggressive savings goal -> tighter cap

            if (!isEssential && adjustedAmount > totalIncome * capRate) {
                adjustedAmount = Math.min(adjustedAmount, totalIncome * capRate);
                reason =
                    profile.profile_type === 'mixed'
                        ? 'Saving & investing goals: capped non-essential spending'
                        : 'Saving focused: capped non-essential spending';
            }
            break;
        }

        case 'spend_control': {
            // Cap at 10% increase from average
            const maxIncrease = categorySpend * 1.1;
            adjustedAmount = Math.min(adjustedAmount, maxIncrease);
            reason = 'Spend control: Limited to 10% increase';
            break;
        }

        case 'rebuild_credit': {
            if (!isEssential) {
                adjustedAmount = categorySpend * 0.9; // Reduce by 10%
                reason = 'Rebuild credit: Reduced non-essential spending';
            }
            break;
        }

        default:
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
    const supabase = getServiceClient();

    const sourceDataDays = options.sourceDataDays || 180;
    const userId = options.userId;

    // Get user profile
    const profile = options.profileType
        ? { profile_type: options.profileType, guardrails: {}, preferences: {}, budget_strategy: 'zero_based' } as UserProfile
        : await getUserProfile(userId);

    // Get spend summary, income, and savings target. Transaction-derived income is
    // unreliable (brokerage transfers, tax refunds, and other one-off inflows all look like
    // "income"), so a user-declared figure in profile.preferences takes priority when set.
    const [categorySpends, txAvgIncome, survey] = await Promise.all([
        getCategorySpendSummary(userId, sourceDataDays),
        getAverageMonthlyIncome(userId, sourceDataDays),
        supabase
            .from('user_survey')
            .select('target_savings_amount, target_savings_timeline_months')
            .eq('user_id', userId)
            .maybeSingle()
            .then((r: any) => r.data),
    ]);

    const declaredIncome = (profile?.preferences as any)?.declared_monthly_income;
    const avgIncome = declaredIncome && declaredIncome > 0 ? declaredIncome : txAvgIncome;

    const monthlySavingsGoal =
        survey?.target_savings_amount && survey?.target_savings_timeline_months
            ? survey.target_savings_amount / survey.target_savings_timeline_months
            : null;

    // Override the profile's static minimum_savings_rate with one derived from the actual
    // goal amount + income, when we have both, instead of the generic per-profile-type default.
    const effectiveProfile: UserProfile | null =
        profile && monthlySavingsGoal && avgIncome > 0
            ? {
                  ...profile,
                  guardrails: {
                      ...profile.guardrails,
                      minimum_savings_rate: monthlySavingsGoal / avgIncome,
                  },
              }
            : profile;

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
                income_source: declaredIncome && declaredIncome > 0 ? 'declared' : 'transaction_derived',
                monthly_savings_goal: monthlySavingsGoal,
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
    const categoryGroupNames = await getCategoryGroupNames(
        supabase,
        categorySpends.map((c) => c.category_id)
    );

    for (const categorySpend of categorySpends) {
        const { adjustedAmount, guardrailReason } = applyGuardrails(
            categorySpend.avg_monthly_spend,
            avgIncome,
            effectiveProfile,
            categoryGroupNames.get(categorySpend.category_id) || categorySpend.category_name
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

    // Ensure the savings/investing goal shows up as its own budget line, even if there's no
    // spend history for it yet (e.g. transfers to external savings/brokerage accounts that
    // aren't Plaid-connected won't show up as categorized transactions). Other categories
    // already tracked under the Savings/Investing group (e.g. a recurring 529 contribution)
    // count toward the goal instead of stacking on top of it.
    if (monthlySavingsGoal && monthlySavingsGoal > 0) {
        const savingsCategoryId = await resolveSavingsGoalCategoryId(supabase, userId);
        if (savingsCategoryId) {
            const existing = budgetItems.find((i) => i.category_id === savingsCategoryId);
            const otherTrackedSavings = budgetItems
                .filter(
                    (i) =>
                        i.category_id !== savingsCategoryId &&
                        PROTECTED_GROUPS.has(categoryGroupNames.get(i.category_id) || '')
                )
                .reduce((sum, i) => sum + (i.user_override_amount ?? i.amount), 0);
            const targetAmount = Math.max(
                existing?.amount || 0,
                monthlySavingsGoal - otherTrackedSavings
            );

            if (existing) {
                const { data: updated } = await supabase
                    .from('budget_items')
                    .update({
                        amount: targetAmount,
                        guardrail_reason: 'Savings/investing goal',
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (updated) Object.assign(existing, updated);
            } else {
                const { data: goalItem, error: goalError } = await supabase
                    .from('budget_items')
                    .insert({
                        budget_plan_id: budgetPlan.id,
                        category_id: savingsCategoryId,
                        amount: targetAmount,
                        guardrail_adjustment: 0,
                        guardrail_reason: 'Savings/investing goal',
                        user_override_amount: null,
                        user_override_reason: null,
                    })
                    .select()
                    .single();
                if (!goalError && goalItem) {
                    budgetItems.push(goalItem as BudgetItem);
                }
            }
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
    const supabase = getServiceClient();

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

export interface RemainingCategoryBudget {
    categoryName: string;
    budgetAmount: number;
    spent: number;
    remaining: number;
}

/**
 * Looks up how much is left in a category's budget for the given month, including all
 * spend recorded so far (used to annotate spend notifications). Returns null if there's
 * no active budget plan for the month or no budget item for this category yet.
 */
export async function getRemainingBudgetForCategory(
    supabase: SupabaseClient,
    userId: string,
    categoryId: string,
    month: string // YYYY-MM
): Promise<RemainingCategoryBudget | null> {
    const { data: budgetPlan } = await supabase
        .from('budget_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('status', 'active')
        .maybeSingle();

    if (!budgetPlan) return null;

    const { data: budgetItem } = await supabase
        .from('budget_items')
        .select('amount, user_override_amount, category_id')
        .eq('budget_plan_id', budgetPlan.id)
        .eq('category_id', categoryId)
        .maybeSingle();

    if (!budgetItem) return null;

    const budgetAmount = budgetItem.user_override_amount ?? budgetItem.amount;
    if (!budgetAmount || budgetAmount <= 0) return null;

    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const nextMonthStart = new Date(Date.UTC(year, monthNum, 1)).toISOString().split('T')[0];

    const [{ data: category }, { data: transactions }] = await Promise.all([
        supabase.from('categories').select('name').eq('id', categoryId).maybeSingle(),
        supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('category_id', categoryId)
            .gte('date', monthStart)
            .lt('date', nextMonthStart)
            .lt('amount', 0)
            .eq('is_transfer', false)
            .is('removed_at', null),
    ]);

    const spent = (transactions || []).reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

    return {
        categoryName: category?.name || 'this category',
        budgetAmount,
        spent,
        remaining: budgetAmount - spent,
    };
}










