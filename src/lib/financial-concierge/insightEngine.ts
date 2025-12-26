/**
 * InsightEngine - Generates insights and recommendations based on user's financial data
 * Outputs: spend trends, recurring subscriptions, unusual spend alerts, cashflow forecast,
 * goal progress, category overages, and personalized action suggestions
 */

import { createClient } from '@supabase/supabase-js';
import {
    Insight,
    InsightType,
    InsightSeverity,
    Recommendation,
    RecommendationType,
    RecommendationStatus,
} from './types';
import { UserProfile } from './types';
import { getUserProfile } from './userProfileService';
import { getActiveBudgetPlan } from './budgetEngine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface InsightGenerationOptions {
    userId: string;
    month: string; // YYYY-MM format
}

/**
 * Generates spend trend insights
 */
async function generateSpendTrendInsights(
    userId: string,
    month: string
): Promise<Insight[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const insights: Insight[] = [];

    // Get current month and previous 3 months
    const currentDate = new Date(month + '-01');
    const months: string[] = [];
    for (let i = 0; i < 4; i++) {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() - i);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // Calculate spend per month
    const monthlySpends: number[] = [];
    for (const monthStr of months.reverse()) {
        const startDate = new Date(monthStr + '-01');
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .gte('date', startDate.toISOString().split('T')[0])
            .lt('date', endDate.toISOString().split('T')[0])
            .lt('amount', 0);

        const total = (transactions || []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        monthlySpends.push(total);
    }

    // Detect trends
    if (monthlySpends.length >= 2) {
        const trend = monthlySpends[monthlySpends.length - 1] - monthlySpends[0];
        const percentChange = (trend / monthlySpends[0]) * 100;

        if (Math.abs(percentChange) > 10) {
            insights.push({
                id: '', // Will be set when inserted
                user_id: userId,
                month,
                insight_type: 'spend_trend',
                insight_data: {
                    trend: percentChange > 0 ? 'increasing' : 'decreasing',
                    percent_change: Math.abs(percentChange),
                    current_month: monthlySpends[monthlySpends.length - 1],
                    previous_month: monthlySpends[0],
                },
                severity: Math.abs(percentChange) > 25 ? 'warning' : 'info',
                acknowledged: false,
                acknowledged_at: null,
                generated_at: new Date().toISOString(),
            } as Insight);
        }
    }

    return insights;
}

/**
 * Generates recurring subscription insights
 */
async function generateRecurringSubscriptionInsights(
    userId: string,
    month: string
): Promise<Insight[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const insights: Insight[] = [];

    // Get recurring items
    const { data: recurringItems } = await supabase
        .from('recurring_items')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);

    if (recurringItems && recurringItems.length > 0) {
        const totalMonthly = recurringItems.reduce(
            (sum, item) => sum + (item.expected_amount || 0),
            0
        );

        insights.push({
            id: '',
            user_id: userId,
            month,
            insight_type: 'recurring_subscription',
            insight_data: {
                total_monthly_recurring: totalMonthly,
                subscription_count: recurringItems.length,
                subscriptions: recurringItems.map(item => ({
                    name: item.merchant_name,
                    amount: item.expected_amount,
                    frequency: item.frequency,
                })),
            },
            severity: 'info',
            acknowledged: false,
            acknowledged_at: null,
            generated_at: new Date().toISOString(),
        } as Insight);
    }

    return insights;
}

/**
 * Generates unusual spend alerts
 */
async function generateUnusualSpendAlerts(
    userId: string,
    month: string
): Promise<Insight[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const insights: Insight[] = [];

    // Get transactions for current month
    const startDate = new Date(month + '-01');
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Get average transaction amount from last 90 days
    const avgStartDate = new Date();
    avgStartDate.setDate(avgStartDate.getDate() - 90);

    const { data: historicalTransactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('date', avgStartDate.toISOString().split('T')[0])
        .lt('date', endDate.toISOString().split('T')[0])
        .lt('amount', 0);

    if (!historicalTransactions || historicalTransactions.length === 0) {
        return insights;
    }

    const amounts = historicalTransactions.map(tx => Math.abs(tx.amount));
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const stdDev = Math.sqrt(
        amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length
    );

    // Get current month transactions
    const { data: currentTransactions } = await supabase
        .from('transactions')
        .select('id, amount, name, note')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lt('date', endDate.toISOString().split('T')[0])
        .lt('amount', 0);

    // Find unusual transactions (more than 2 standard deviations above mean)
    const threshold = avgAmount + 2 * stdDev;
    const unusualTransactions = (currentTransactions || []).filter(
        tx => Math.abs(tx.amount) > threshold
    );

    if (unusualTransactions.length > 0) {
        insights.push({
            id: '',
            user_id: userId,
            month,
            insight_type: 'unusual_spend',
            insight_data: {
                unusual_count: unusualTransactions.length,
                threshold,
                transactions: unusualTransactions.map(tx => ({
                    name: tx.name,
                    amount: Math.abs(tx.amount),
                    date: tx.note, // Will need to include date
                })),
            },
            severity: unusualTransactions.length > 3 ? 'warning' : 'info',
            acknowledged: false,
            acknowledged_at: null,
            generated_at: new Date().toISOString(),
        } as Insight);
    }

    return insights;
}

/**
 * Generates cashflow forecast
 */
async function generateCashflowForecast(
    userId: string,
    month: string
): Promise<Insight[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const insights: Insight[] = [];

    // Get average monthly income and expenses
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lt('date', endDate.toISOString().split('T')[0]);

    const income = (transactions || [])
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = (transactions || [])
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const avgMonthlyIncome = income / 3;
    const avgMonthlyExpenses = expenses / 3;
    const forecastCashflow = avgMonthlyIncome - avgMonthlyExpenses;

    // Forecast next 3 months
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
        const forecastDate = new Date(month + '-01');
        forecastDate.setMonth(forecastDate.getMonth() + i);
        forecast.push({
            month: `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`,
            projected_income: avgMonthlyIncome,
            projected_expenses: avgMonthlyExpenses,
            projected_cashflow: forecastCashflow,
        });
    }

    insights.push({
        id: '',
        user_id: userId,
        month,
        insight_type: 'cashflow_forecast',
        insight_data: {
            current_monthly_income: avgMonthlyIncome,
            current_monthly_expenses: avgMonthlyExpenses,
            forecast,
        },
        severity: forecastCashflow < 0 ? 'warning' : 'info',
        acknowledged: false,
        acknowledged_at: null,
        generated_at: new Date().toISOString(),
    } as Insight);

    return insights;
}

/**
 * Generates category overage insights
 */
async function generateCategoryOverageInsights(
    userId: string,
    month: string
): Promise<Insight[]> {
    const insights: Insight[] = [];

    const budgetPlan = await getActiveBudgetPlan(userId, month);
    if (!budgetPlan) {
        return insights;
    }

    // Get actual spend for each category
    const startDate = new Date(month + '-01');
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const overages: Array<{ category_id: string; category_name: string; budget: number; actual: number; overage: number }> = [];

    for (const budgetItem of budgetPlan.items) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
            },
        });

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('category_id', budgetItem.category_id)
            .gte('date', startDate.toISOString().split('T')[0])
            .lt('date', endDate.toISOString().split('T')[0])
            .lt('amount', 0);

        const actualSpend = (transactions || []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        const overage = actualSpend - budgetItem.amount;

        if (overage > 0) {
            // Get category name
            const { data: category } = await supabase
                .from('categories')
                .select('name')
                .eq('id', budgetItem.category_id)
                .single();

            overages.push({
                category_id: budgetItem.category_id,
                category_name: category?.name || 'Unknown',
                budget: budgetItem.amount,
                actual: actualSpend,
                overage,
            });
        }
    }

    if (overages.length > 0) {
        insights.push({
            id: '',
            user_id: userId,
            month,
            insight_type: 'category_overage',
            insight_data: {
                overage_count: overages.length,
                total_overage: overages.reduce((sum, o) => sum + o.overage, 0),
                overages,
            },
            severity: overages.reduce((sum, o) => sum + o.overage, 0) > 500 ? 'warning' : 'info',
            acknowledged: false,
            acknowledged_at: null,
            generated_at: new Date().toISOString(),
        } as Insight);
    }

    return insights;
}

/**
 * Generates personalized recommendations based on profile and goals
 */
async function generateRecommendations(
    userId: string,
    month: string
): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const profile = await getUserProfile(userId);

    if (!profile) {
        return recommendations;
    }

    // Get user survey for goals
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const { data: survey } = await supabase
        .from('user_survey')
        .select('*')
        .eq('user_id', userId)
        .single();

    // Generate recommendations based on profile type and goals
    if (profile.profile_type === 'debt_payoff' && survey?.goal_debt_payoff) {
        recommendations.push({
            id: '',
            user_id: userId,
            month,
            recommendation_type: 'pay_down_debt',
            title: 'Focus on Debt Payoff',
            description: 'Consider using the avalanche or snowball method to accelerate debt payoff.',
            action_items: [
                'List all debts with APRs',
                'Allocate extra funds to highest APR debt (avalanche) or smallest balance (snowball)',
                'Reduce discretionary spending by 10% to free up more for debt',
            ],
            linked_goals: ['debt_payoff'],
            priority: 5,
            status: 'pending' as RecommendationStatus,
            status_updated_at: null,
            generated_at: new Date().toISOString(),
        } as Recommendation);
    }

    if (profile.profile_type === 'saving_focused' && survey?.goal_saving) {
        recommendations.push({
            id: '',
            user_id: userId,
            month,
            recommendation_type: 'increase_savings',
            title: 'Boost Savings Rate',
            description: 'You\'re focused on saving. Consider automating transfers to savings.',
            action_items: [
                'Set up automatic transfers to savings account',
                'Create sinking funds for large upcoming expenses',
                'Review and reduce unnecessary subscriptions',
            ],
            linked_goals: ['saving'],
            priority: 4,
            status: 'pending' as RecommendationStatus,
            status_updated_at: null,
            generated_at: new Date().toISOString(),
        } as Recommendation);
    }

    // Add more recommendations based on insights
    // This is simplified - in production, would analyze actual data more deeply

    return recommendations;
}

/**
 * Generates all insights and recommendations for a user/month
 */
export async function generateInsights(
    options: InsightGenerationOptions
): Promise<{ insights: Insight[]; recommendations: Recommendation[] }> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const { userId, month } = options;

    // Generate all insight types
    const [
        spendTrends,
        recurringSubscriptions,
        unusualSpends,
        cashflowForecast,
        categoryOverages,
        recommendations,
    ] = await Promise.all([
        generateSpendTrendInsights(userId, month),
        generateRecurringSubscriptionInsights(userId, month),
        generateUnusualSpendAlerts(userId, month),
        generateCashflowForecast(userId, month),
        generateCategoryOverageInsights(userId, month),
        generateRecommendations(userId, month),
    ]);

    const allInsights = [
        ...spendTrends,
        ...recurringSubscriptions,
        ...unusualSpends,
        ...cashflowForecast,
        ...categoryOverages,
    ];

    // Insert insights into database
    const insertedInsights: Insight[] = [];
    for (const insight of allInsights) {
        const { data, error } = await supabase
            .from('insights')
            .insert({
                user_id: insight.user_id,
                month: insight.month,
                insight_type: insight.insight_type,
                insight_data: insight.insight_data,
                severity: insight.severity,
            })
            .select()
            .single();

        if (!error && data) {
            insertedInsights.push(data as Insight);
        }
    }

    // Insert recommendations into database
    const insertedRecommendations: Recommendation[] = [];
    for (const rec of recommendations) {
        const { data, error } = await supabase
            .from('recommendations')
            .insert({
                user_id: rec.user_id,
                month: rec.month,
                recommendation_type: rec.recommendation_type,
                title: rec.title,
                description: rec.description,
                action_items: rec.action_items,
                linked_goals: rec.linked_goals,
                priority: rec.priority,
                status: rec.status,
            })
            .select()
            .single();

        if (!error && data) {
            insertedRecommendations.push(data as Recommendation);
        }
    }

    return {
        insights: insertedInsights,
        recommendations: insertedRecommendations,
    };
}


