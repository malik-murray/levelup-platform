'use client';

import { useState, useEffect, useMemo, FormEvent } from 'react';
import { BudgetPlan, BudgetItem } from '@/lib/financial-concierge/types';
import { useFeatureFlags } from '@/lib/featureFlags';
import { supabase } from '@auth/supabaseClient';
import { ExplainabilityTooltip } from '@/components/ExplainabilityTooltip';

interface BudgetItemWithSpend extends BudgetItem {
    category_name?: string;
    actual_spend?: number;
    overage?: number;
}

interface BudgetPlanWithItems extends BudgetPlan {
    items: BudgetItemWithSpend[];
}

const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Loads a plan's budget items and computes each category's actual spend for `spendMonth`
 * (which may differ from the plan's own month when the budget is carried forward).
 */
async function loadItemsWithSpend(
    userId: string,
    planId: string,
    spendMonth: string
): Promise<BudgetItemWithSpend[]> {
    const { data: items, error } = await supabase
        .from('budget_items')
        .select(`*, categories!inner(name)`)
        .eq('budget_plan_id', planId);
    if (error) throw error;

    const startDate = new Date(spendMonth + '-01');
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    return Promise.all(
        (items || []).map(async (item) => {
            const { data: transactions } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .eq('category_id', item.category_id)
                .gte('date', startDate.toISOString().split('T')[0])
                .lt('date', endDate.toISOString().split('T')[0])
                .lt('amount', 0);

            const actualSpend = (transactions || []).reduce(
                (sum, tx) => sum + Math.abs(tx.amount),
                0
            );

            const category = (item.categories as any)?.[0] || item.categories;
            return {
                ...item,
                category_name: category?.name || 'Unknown',
                actual_spend: actualSpend,
                overage: Math.max(0, actualSpend - item.amount),
            } as BudgetItemWithSpend;
        })
    );
}

export default function ConciergeBudgetPage() {
    const featureFlags = useFeatureFlags();
    const [loading, setLoading] = useState(true);
    const [budgetPlan, setBudgetPlan] = useState<BudgetPlanWithItems | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [approving, setApproving] = useState(false);
    // When set, the shown budget is inherited from an approved plan of an earlier month.
    const [carriedForwardFrom, setCarriedForwardFrom] = useState<string | null>(null);
    // Goal form (savings + investing) shown before generating/regenerating a budget.
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [savingsGoalInput, setSavingsGoalInput] = useState('');
    const [investingGoalInput, setInvestingGoalInput] = useState('');
    // Survey-derived default monthly savings, used to prefill the form the first time.
    const [surveySavings, setSurveySavings] = useState<number | null>(null);
    const [month, setMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        loadBudgetPlan();
    }, [month]);

    // Pull the survey's monthly savings figure once, for prefilling the goal form.
    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('user_survey')
                .select('target_savings_amount, target_savings_timeline_months')
                .eq('user_id', user.id)
                .maybeSingle();
            if (data?.target_savings_amount && data?.target_savings_timeline_months) {
                setSurveySavings(data.target_savings_amount / data.target_savings_timeline_months);
            }
        })();
    }, []);

    const loadBudgetPlan = async () => {
        setLoading(true);
        setError(null);
        setCarriedForwardFrom(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not authenticated');
                return;
            }

            // 1. An explicit active plan for this month wins.
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

            if (plan) {
                const items = await loadItemsWithSpend(user.id, plan.id, month);
                setBudgetPlan({ ...plan, items } as BudgetPlanWithItems);
                return;
            }

            // 2. No plan for this month — inherit the most recent approved plan from an
            //    earlier month (lazy carry-forward). Regenerating this month overrides it.
            const { data: priorPlans } = await supabase
                .from('budget_plans')
                .select('*')
                .eq('user_id', user.id)
                .lt('month', month)
                .not('metadata->>approved_at', 'is', null)
                .order('month', { ascending: false })
                .limit(1);

            const inherited = priorPlans?.[0];
            if (inherited) {
                const items = await loadItemsWithSpend(user.id, inherited.id, month);
                setBudgetPlan({ ...inherited, month, items } as BudgetPlanWithItems);
                setCarriedForwardFrom(inherited.month);
                return;
            }

            // 3. Nothing to show — offer to generate.
            setBudgetPlan(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load budget plan');
        } finally {
            setLoading(false);
        }
    };

    // Prefill the goal fields from the current plan's saved goals, else the survey figure.
    const openGoalForm = () => {
        const meta = (budgetPlan?.metadata as any) || {};
        const savingsDefault =
            typeof meta.savings_goal === 'number'
                ? meta.savings_goal
                : surveySavings ?? '';
        const investingDefault =
            typeof meta.investing_goal === 'number' ? meta.investing_goal : '';
        setSavingsGoalInput(savingsDefault === '' ? '' : String(savingsDefault));
        setInvestingGoalInput(investingDefault === '' ? '' : String(investingDefault));
        setShowGoalForm(true);
    };

    const handleGenerateBudget = async (e: FormEvent) => {
        e.preventDefault();
        setGenerating(true);
        setError(null);
        try {
            const response = await fetch('/api/financial-concierge/generate-budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month,
                    savings_goal: savingsGoalInput === '' ? undefined : parseFloat(savingsGoalInput),
                    investing_goal: investingGoalInput === '' ? undefined : parseFloat(investingGoalInput),
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate budget');
            }

            setShowGoalForm(false);
            await loadBudgetPlan();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate budget');
        } finally {
            setGenerating(false);
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
    const isApproved = Boolean((budgetPlan?.metadata as any)?.approved_at) && !carriedForwardFrom;

    const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const goalFormModal = showGoalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <form
                onSubmit={handleGenerateBudget}
                className="w-full max-w-md rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 space-y-4"
            >
                <div>
                    <h3 className="text-lg font-semibold">Set your monthly goals</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        We&apos;ll build {monthLabel}&apos;s budget from your last 6 months, fund
                        these goals and your recurring bills first, then fit the rest to your income.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Monthly savings goal</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                            type="number"
                            min="0"
                            step="10"
                            inputMode="decimal"
                            value={savingsGoalInput}
                            onChange={(e) => setSavingsGoalInput(e.target.value)}
                            placeholder="0"
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent pl-7 pr-3 py-2"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Monthly investing goal</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                            type="number"
                            min="0"
                            step="10"
                            inputMode="decimal"
                            value={investingGoalInput}
                            onChange={(e) => setInvestingGoalInput(e.target.value)}
                            placeholder="0"
                            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent pl-7 pr-3 py-2"
                        />
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        type="submit"
                        disabled={generating}
                        className="flex-1 rounded-md bg-amber-500 px-4 py-2 font-medium text-black hover:bg-amber-600 disabled:opacity-50"
                    >
                        {generating ? 'Generating…' : 'Generate budget'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGoalForm(false)}
                        disabled={generating}
                        className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2 font-medium hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );

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
            <>
                {goalFormModal}
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <h1 className="text-2xl font-bold mb-6">Budget Plan</h1>
                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
                            {error}
                        </div>
                    )}
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 text-center">
                        <h2 className="text-xl font-semibold mb-2">No Budget Plan Found</h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Generate an automated budget for {monthLabel} based on your spending
                            history and your savings &amp; investing goals.
                        </p>
                        <button
                            onClick={openGoalForm}
                            disabled={loading}
                            className="px-6 py-3 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
                        >
                            Generate Budget Plan
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Header bar: available-to-spend (budget) split into spent vs remaining. When overspent,
    // the whole bar is spent and the overage is called out separately.
    const spentPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
    const overspent = remaining < 0;

    return (
        <>
            {goalFormModal}
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Budget Plan</h1>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{monthLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openGoalForm}
                            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                        >
                            {carriedForwardFrom ? 'Customize this month' : 'Regenerate'}
                        </button>
                        {!carriedForwardFrom && (
                            <button
                                onClick={handleApproveBudget}
                                disabled={approving}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50"
                            >
                                {approving ? 'Approving...' : isApproved ? '✓ Approved' : '✓ Approve Budget'}
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
                        {error}
                    </div>
                )}

                {carriedForwardFrom && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
                        Carried forward from{' '}
                        {new Date(carriedForwardFrom + '-01').toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                        })}
                        . This approved budget applies to every future month automatically —
                        &ldquo;Customize this month&rdquo; to set a different budget just for {monthLabel}.
                    </div>
                )}

                {isApproved && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-200">
                        Approved — this budget carries forward to all future months unless you
                        regenerate or edit them.
                    </div>
                )}

                {/* Monthly spend graph: available to spend, spent, remaining/excess */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-end justify-between flex-wrap gap-2 mb-3">
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Available to spend</p>
                            <p className="text-3xl font-bold">${fmt(totalBudget)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase">
                                {overspent ? 'Over budget' : 'Remaining this month'}
                            </p>
                            <p
                                className={`text-3xl font-bold ${
                                    overspent ? 'text-red-600' : 'text-green-600'
                                }`}
                            >
                                ${fmt(Math.abs(remaining))}
                            </p>
                        </div>
                    </div>

                    <div className="w-full h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                        <div
                            className={`h-4 ${overspent ? 'bg-red-500' : 'bg-amber-500'}`}
                            style={{ width: `${spentPct}%` }}
                            title={`Spent $${fmt(totalSpent)}`}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-600 dark:text-slate-400">
                        <span>
                            Spent <strong>${fmt(totalSpent)}</strong>
                        </span>
                        <span>
                            {overspent ? (
                                <>Over by <strong className="text-red-600">${fmt(-remaining)}</strong></>
                            ) : (
                                <>Left <strong className="text-green-600">${fmt(remaining)}</strong></>
                            )}
                        </span>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                            Total Budget
                        </p>
                        <p className="text-2xl font-semibold">${fmt(totalBudget)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                            Total Spent
                        </p>
                        <p className="text-2xl font-semibold">${fmt(totalSpent)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                            Remaining
                        </p>
                        <p className={`text-2xl font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${fmt(remaining)}
                        </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-600 dark:text-slate-400 uppercase mb-1">
                            Overage
                        </p>
                        <p className={`text-2xl font-semibold ${totalOverage > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                            ${fmt(totalOverage)}
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
                                                ${fmt(item.actual_spend || 0)} / ${fmt(item.amount)}
                                            </div>
                                            {item.overage && item.overage > 0 && (
                                                <div className="text-xs text-red-600 font-medium">
                                                    Over by ${fmt(item.overage)}
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
        </>
    );
}
