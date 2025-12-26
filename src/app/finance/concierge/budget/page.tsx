'use client';

import { useState, useEffect, useMemo } from 'react';
import { BudgetPlan, BudgetItem } from '@/lib/financial-concierge/types';
import { useFeatureFlags } from '@/lib/featureFlags';
import { supabase } from '@auth/supabaseClient';
import { ExplainabilityTooltip } from '@/components/ExplainabilityTooltip';

interface BudgetPlanWithItems extends BudgetPlan {
    items: Array<BudgetItem & { category_name?: string; actual_spend?: number; overage?: number }>;
}

export default function ConciergeBudgetPage() {
    const featureFlags = useFeatureFlags();
    const [loading, setLoading] = useState(true);
    const [budgetPlan, setBudgetPlan] = useState<BudgetPlanWithItems | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [approving, setApproving] = useState(false);
    const [month, setMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        loadBudgetPlan();
    }, [month]);

    const loadBudgetPlan = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not authenticated');
                return;
            }

            // Check if budget plan exists
            const { data: plan, error: planError } = await supabase
                .from('budget_plans')
                .select('*')
                .eq('user_id', user.id)
                .eq('month', month)
                .eq('status', 'active')
                .single();

            if (planError && planError.code !== 'PGRST116') {
                throw planError;
            }

            if (!plan) {
                // No budget plan yet - offer to generate
                setBudgetPlan(null);
                setLoading(false);
                return;
            }

            // Load budget items with category names
            const { data: items, error: itemsError } = await supabase
                .from('budget_items')
                .select(`
                    *,
                    categories!inner(name)
                `)
                .eq('budget_plan_id', plan.id);

            if (itemsError) throw itemsError;

            // Calculate actual spend for each category
            const startDate = new Date(month + '-01');
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);

            const itemsWithSpend = await Promise.all(
                (items || []).map(async (item) => {
                    const { data: transactions } = await supabase
                        .from('transactions')
                        .select('amount')
                        .eq('user_id', user.id)
                        .eq('category_id', item.category_id)
                        .gte('date', startDate.toISOString().split('T')[0])
                        .lt('date', endDate.toISOString().split('T')[0])
                        .lt('amount', 0);

                    const actualSpend = (transactions || []).reduce(
                        (sum, tx) => sum + Math.abs(tx.amount),
                        0
                    );

                    const category = (item.categories as any)?.[0] || item.categories;
                    const categoryName = category?.name || 'Unknown';

                    return {
                        ...item,
                        category_name: categoryName,
                        actual_spend: actualSpend,
                        overage: Math.max(0, actualSpend - item.amount),
                    };
                })
            );

            setBudgetPlan({
                ...plan,
                items: itemsWithSpend,
            } as BudgetPlanWithItems);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load budget plan');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBudget = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/financial-concierge/generate-budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate budget');
            }

            await loadBudgetPlan();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate budget');
            setLoading(false);
        }
    };

    const handleApproveBudget = async () => {
        if (!budgetPlan) return;

        setApproving(true);
        try {
            const response = await fetch('/api/financial-concierge/approve-budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ budget_plan_id: budgetPlan.id }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to approve budget');
            }

            setError(null);
            // Reload to show updated metadata
            await loadBudgetPlan();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to approve budget');
        } finally {
            setApproving(false);
        }
    };

    const totalBudget = useMemo(
        () => budgetPlan?.items.reduce((sum, item) => sum + item.amount, 0) || 0,
        [budgetPlan]
    );

    const totalSpent = useMemo(
        () => budgetPlan?.items.reduce((sum, item) => sum + (item.actual_spend || 0), 0) || 0,
        [budgetPlan]
    );

    const totalOverage = useMemo(
        () => budgetPlan?.items.reduce((sum, item) => sum + (item.overage || 0), 0) || 0,
        [budgetPlan]
    );

    const remaining = totalBudget - totalSpent;

    if (!featureFlags.conciergeBudgetGeneration) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold mb-2">Budget Generation Not Available</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Upgrade to Basic tier or higher to access automated budget generation.
                    </p>
                </div>
            </div>
        );
    }

    if (loading && !budgetPlan) {
        return <div className="text-center py-8">Loading...</div>;
    }

    if (!budgetPlan) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">Budget Plan</h1>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold mb-2">No Budget Plan Found</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Generate an automated budget plan based on your spending history.
                    </p>
                    <button
                        onClick={handleGenerateBudget}
                        disabled={loading}
                        className="px-6 py-3 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
                    >
                        {loading ? 'Generating...' : 'Generate Budget Plan'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Budget Plan</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {new Date(month + '-01').toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <button
                    onClick={handleApproveBudget}
                    disabled={approving}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50"
                >
                    {approving ? 'Approving...' : '✓ Approve Budget'}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Total Budget
                    </p>
                    <p className="text-2xl font-semibold">
                        ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Total Spent
                    </p>
                    <p className="text-2xl font-semibold">
                        ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Remaining
                    </p>
                    <p className={`text-2xl font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                        Overage
                    </p>
                    <p className={`text-2xl font-semibold ${totalOverage > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        ${totalOverage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Budget Items */}
            <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="font-semibold">Budget by Category</h2>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {budgetPlan.items.map((item) => {
                        const progress = item.amount > 0 ? (item.actual_spend || 0) / item.amount : 0;
                        const isOver = (item.actual_spend || 0) > item.amount;

                        return (
                            <div
                                key={item.id}
                                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-medium truncate">{item.category_name}</h3>
                                            {item.guardrail_reason && (
                                                <ExplainabilityTooltip
                                                    explanation={item.guardrail_reason}
                                                    method="Guardrail adjustment"
                                                >
                                                    <span className="text-xs text-amber-600 dark:text-amber-400 cursor-help">
                                                        ℹ️
                                                    </span>
                                                </ExplainabilityTooltip>
                                            )}
                                        </div>
                                        {item.guardrail_adjustment !== 0 && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                Guardrail adjustment: ${item.guardrail_adjustment.toFixed(2)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-medium">
                                            ${(item.actual_spend || 0).toLocaleString('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}{' '}
                                            / ${item.amount.toLocaleString('en-US', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </div>
                                        {item.overage && item.overage > 0 && (
                                            <div className="text-xs text-red-600 font-medium">
                                                Over by ${item.overage.toLocaleString('en-US', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${
                                            isOver
                                                ? 'bg-red-500'
                                                : progress > 0.9
                                                  ? 'bg-yellow-500'
                                                  : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(100, progress * 100)}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Generation Info */}
            {budgetPlan.generated_by === 'auto' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
                    <p className="font-medium mb-1">Auto-generated Budget</p>
                    <p className="text-slate-600 dark:text-slate-400">
                        This budget was automatically generated based on your spending from{' '}
                        {new Date(budgetPlan.source_data_start_date).toLocaleDateString()} to{' '}
                        {new Date(budgetPlan.source_data_end_date).toLocaleDateString()}, with
                        adjustments based on your financial profile ({budgetPlan.profile_type || 'mixed'}).
                    </p>
                </div>
            )}
        </div>
    );
}

