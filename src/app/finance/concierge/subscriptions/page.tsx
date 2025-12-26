'use client';

import { useState, useEffect } from 'react';
import { RecurringItem } from '@/lib/financial-concierge/types';
import { useFeatureFlags } from '@/lib/featureFlags';
import { supabase } from '@auth/supabaseClient';

export default function SubscriptionsPage() {
    const featureFlags = useFeatureFlags();
    const [loading, setLoading] = useState(true);
    const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<string | null>(null);

    useEffect(() => {
        loadRecurringItems();
    }, []);

    const loadRecurringItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError('Not authenticated');
                return;
            }

            const { data, error: fetchError } = await supabase
                .from('recurring_items')
                .select(`
                    *,
                    categories(name)
                `)
                .eq('user_id', user.id)
                .order('expected_amount', { ascending: false, nullsLast: true });

            if (fetchError) throw fetchError;
            setRecurringItems((data || []) as RecurringItem[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmItem = async (itemId: string, confirmed: boolean) => {
        setConfirming(itemId);
        try {
            const response = await fetch('/api/financial-concierge/confirm-recurring-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recurring_item_id: itemId,
                    confirmed,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to confirm item');
            }

            await loadRecurringItems();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to confirm item');
        } finally {
            setConfirming(null);
        }
    };

    const getFrequencyLabel = (frequency: RecurringItem['frequency']) => {
        switch (frequency) {
            case 'weekly':
                return 'Weekly';
            case 'biweekly':
                return 'Bi-weekly';
            case 'monthly':
                return 'Monthly';
            case 'quarterly':
                return 'Quarterly';
            case 'yearly':
                return 'Yearly';
            default:
                return frequency;
        }
    };

    const unconfirmedItems = recurringItems.filter(item => !item.confirmed_by_user);
    const confirmedItems = recurringItems.filter(item => item.confirmed_by_user && item.active);

    if (!featureFlags.conciergeInsights) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold mb-2">Subscriptions Not Available</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Upgrade to Basic tier or higher to access subscription management.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    const totalMonthly = confirmedItems.reduce(
        (sum, item) => sum + (item.expected_amount || 0),
        0
    );

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Recurring Subscriptions</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Review and confirm detected recurring payments
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Summary */}
            {confirmedItems.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Total Monthly Subscriptions</p>
                            <p className="text-2xl font-semibold">
                                ${totalMonthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-600 dark:text-slate-400">Active Subscriptions</p>
                            <p className="text-2xl font-semibold">{confirmedItems.length}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Unconfirmed Items */}
            {unconfirmedItems.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Pending Confirmation</h2>
                    <div className="space-y-3">
                        {unconfirmedItems.map((item) => {
                            const category = (item.categories as any)?.[0] || item.categories;
                            const categoryName = category?.name || 'Uncategorized';

                            return (
                                <div
                                    key={item.id}
                                    className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold mb-1">{item.merchant_name}</h3>
                                            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                                <p>Category: {categoryName}</p>
                                                <p>Frequency: {getFrequencyLabel(item.frequency)}</p>
                                                {item.expected_amount && (
                                                    <p>
                                                        Amount: $
                                                        {item.expected_amount.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                        })}
                                                    </p>
                                                )}
                                                <p>Occurrences detected: {item.occurrence_count}</p>
                                                {item.last_occurrence_date && (
                                                    <p>Last: {new Date(item.last_occurrence_date).toLocaleDateString()}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleConfirmItem(item.id, true)}
                                                disabled={confirming === item.id}
                                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-50"
                                            >
                                                {confirming === item.id ? '...' : 'Confirm'}
                                            </button>
                                            <button
                                                onClick={() => handleConfirmItem(item.id, false)}
                                                disabled={confirming === item.id}
                                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Confirmed Items */}
            {confirmedItems.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-4">Confirmed Subscriptions</h2>
                    <div className="space-y-3">
                        {confirmedItems.map((item) => {
                            const category = (item.categories as any)?.[0] || item.categories;
                            const categoryName = category?.name || 'Uncategorized';

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold mb-1">{item.merchant_name}</h3>
                                            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                                <p>Category: {categoryName}</p>
                                                <p>Frequency: {getFrequencyLabel(item.frequency)}</p>
                                                {item.expected_amount && (
                                                    <p>
                                                        Amount: $
                                                        {item.expected_amount.toLocaleString('en-US', {
                                                            minimumFractionDigits: 2,
                                                        })}
                                                    </p>
                                                )}
                                                {item.next_expected_date && (
                                                    <p>
                                                        Next expected: {new Date(item.next_expected_date).toLocaleDateString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {recurringItems.length === 0 && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 text-center">
                    <h2 className="text-xl font-semibold mb-2">No Recurring Items Found</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Recurring subscriptions and bills will appear here once detected from your transactions.
                    </p>
                </div>
            )}
        </div>
    );
}

