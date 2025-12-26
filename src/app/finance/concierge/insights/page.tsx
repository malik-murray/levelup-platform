'use client';

import { useState, useEffect } from 'react';
import { Insight, Recommendation } from '@/lib/financial-concierge/types';
import { useFeatureFlags } from '@/lib/featureFlags';
import { supabase } from '@auth/supabaseClient';
import { RecommendationTooltip } from '@/components/ExplainabilityTooltip';

export default function ConciergeInsightsPage() {
    const featureFlags = useFeatureFlags();
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [month, setMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        loadInsights();
    }, [month]);

    const loadInsights = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not authenticated');
                return;
            }

            const [insightsRes, recommendationsRes] = await Promise.all([
                supabase
                    .from('insights')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('month', month)
                    .order('severity', { ascending: false })
                    .order('generated_at', { ascending: false }),
                supabase
                    .from('recommendations')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('month', month)
                    .order('priority', { ascending: false })
                    .order('generated_at', { ascending: false }),
            ]);

            if (insightsRes.error) throw insightsRes.error;
            if (recommendationsRes.error) throw recommendationsRes.error;

            setInsights((insightsRes.data || []) as Insight[]);
            setRecommendations((recommendationsRes.data || []) as Recommendation[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load insights');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateInsights = async () => {
        setGenerating(true);
        try {
            const response = await fetch('/api/financial-concierge/generate-insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate insights');
            }

            await loadInsights();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate insights');
        } finally {
            setGenerating(false);
        }
    };

    const handleUpdateRecommendationStatus = async (
        recommendationId: string,
        status: Recommendation['status']
    ) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('recommendations')
                .update({
                    status,
                    status_updated_at: new Date().toISOString(),
                })
                .eq('id', recommendationId)
                .eq('user_id', user.id);

            if (error) throw error;
            await loadInsights();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update recommendation');
        }
    };

    const handleAcknowledgeInsight = async (insightId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('insights')
                .update({
                    acknowledged: true,
                    acknowledged_at: new Date().toISOString(),
                })
                .eq('id', insightId)
                .eq('user_id', user.id);

            if (error) throw error;
            await loadInsights();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to acknowledge insight');
        }
    };

    const getSeverityColor = (severity: Insight['severity']) => {
        switch (severity) {
            case 'critical':
                return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
            case 'warning':
                return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
            default:
                return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
        }
    };

    const getInsightIcon = (type: Insight['insight_type']) => {
        switch (type) {
            case 'spend_trend':
                return '📈';
            case 'recurring_subscription':
                return '🔄';
            case 'unusual_spend':
                return '⚠️';
            case 'cashflow_forecast':
                return '💵';
            case 'goal_progress':
                return '🎯';
            case 'category_overage':
                return '📊';
            case 'opportunity':
                return '💡';
            default:
                return 'ℹ️';
        }
    };

    if (!featureFlags.conciergeInsights) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold mb-2">Insights Not Available</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Upgrade to Basic tier or higher to access personalized financial insights.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Financial Insights</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {new Date(month + '-01').toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <button
                    onClick={handleGenerateInsights}
                    disabled={generating}
                    className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
                >
                    {generating ? 'Generating...' : 'Generate Insights'}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Recommendations */}
            {featureFlags.conciergeRecommendations && recommendations.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Recommended Actions</h2>
                    <div className="space-y-4">
                        {recommendations.map((rec) => (
                            <div
                                key={rec.id}
                                className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-4"
                            >
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <RecommendationTooltip
                                                reason={rec.description}
                                                linkedGoals={rec.linked_goals}
                                            >
                                                <h3 className="font-semibold text-lg">{rec.title}</h3>
                                            </RecommendationTooltip>
                                            {rec.linked_goals.length > 0 && (
                                                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-1 rounded">
                                                    {rec.linked_goals.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-400 mb-3">
                                            {rec.description}
                                        </p>
                                        {rec.action_items.length > 0 && (
                                            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                                {rec.action_items.map((action, idx) => (
                                                    <li key={idx}>{action}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 flex-shrink-0">
                                        <select
                                            value={rec.status}
                                            onChange={(e) =>
                                                handleUpdateRecommendationStatus(
                                                    rec.id,
                                                    e.target.value as Recommendation['status']
                                                )
                                            }
                                            className="text-xs px-2 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="dismissed">Dismissed</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500">
                                    Priority: {rec.priority} • Type: {rec.recommendation_type}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Insights */}
            {insights.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Insights</h2>
                    <div className="space-y-4">
                        {insights.map((insight) => (
                            <div
                                key={insight.id}
                                className={`rounded-lg border p-4 ${
                                    insight.acknowledged
                                        ? 'opacity-60 bg-slate-50 dark:bg-slate-900'
                                        : getSeverityColor(insight.severity)
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">{getInsightIcon(insight.insight_type)}</span>
                                            <h3 className="font-semibold capitalize">
                                                {insight.insight_type.replace(/_/g, ' ')}
                                            </h3>
                                            <span className="text-xs bg-white/50 dark:bg-black/50 px-2 py-1 rounded capitalize">
                                                {insight.severity}
                                            </span>
                                        </div>
                                        <div className="text-sm">
                                            {insight.insight_type === 'spend_trend' && (
                                                <div>
                                                    <p>
                                                        Spend is{' '}
                                                        {insight.insight_data.trend === 'increasing'
                                                            ? 'increasing'
                                                            : 'decreasing'}{' '}
                                                        by{' '}
                                                        {insight.insight_data.percent_change?.toFixed(1)}% compared to
                                                        previous month.
                                                    </p>
                                                </div>
                                            )}
                                            {insight.insight_type === 'recurring_subscription' && (
                                                <div>
                                                    <p>
                                                        You have {insight.insight_data.subscription_count} active
                                                        subscriptions totaling $
                                                        {insight.insight_data.total_monthly_recurring?.toLocaleString(
                                                            'en-US',
                                                            { minimumFractionDigits: 2 }
                                                        )}{' '}
                                                        per month.
                                                    </p>
                                                </div>
                                            )}
                                            {insight.insight_type === 'unusual_spend' && (
                                                <div>
                                                    <p>
                                                        {insight.insight_data.unusual_count} unusual transactions
                                                        detected (above ${insight.insight_data.threshold?.toLocaleString(
                                                            'en-US',
                                                            { minimumFractionDigits: 2 }
                                                        )}).
                                                    </p>
                                                </div>
                                            )}
                                            {insight.insight_type === 'cashflow_forecast' && (
                                                <div>
                                                    <p>
                                                        Projected monthly cashflow: $
                                                        {insight.insight_data.forecast?.[0]?.projected_cashflow?.toLocaleString(
                                                            'en-US',
                                                            { minimumFractionDigits: 2 }
                                                        )}
                                                    </p>
                                                </div>
                                            )}
                                            {insight.insight_type === 'category_overage' && (
                                                <div>
                                                    <p>
                                                        {insight.insight_data.overage_count} categories over budget
                                                        with total overage of $
                                                        {insight.insight_data.total_overage?.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                        })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {!insight.acknowledged && (
                                        <button
                                            onClick={() => handleAcknowledgeInsight(insight.id)}
                                            className="text-xs px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Mark as read
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {insights.length === 0 && recommendations.length === 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold mb-2">No Insights Yet</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Generate insights to see personalized recommendations and financial analysis.
                    </p>
                    <button
                        onClick={handleGenerateInsights}
                        disabled={generating}
                        className="px-6 py-3 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
                    >
                        {generating ? 'Generating...' : 'Generate Insights'}
                    </button>
                </div>
            )}
        </div>
    );
}

