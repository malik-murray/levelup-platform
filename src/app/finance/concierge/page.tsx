'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserProfile } from '@/lib/financial-concierge/types';

export default function ConciergeDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const response = await fetch('/api/financial-concierge/profile');
            const data = await response.json();
            setProfile(data.profile);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncTransactions = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const response = await fetch('/api/financial-concierge/sync-transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date_range_days: 30 }),
            });
            const data = await response.json();
            if (data.success) {
                setSyncResult(`Synced ${data.transactions_synced} transactions`);
            } else {
                setSyncResult(`Error: ${data.error || 'Sync failed'}`);
            }
        } catch (error) {
            setSyncResult('Failed to sync transactions');
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    if (!profile) {
        return (
            <div className="text-center py-8">
                <h1 className="text-2xl font-bold mb-4">Financial Concierge</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Complete the survey to get personalized financial insights
                </p>
                <Link
                    href="/finance/concierge/survey"
                    className="inline-block px-6 py-3 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium"
                >
                    Take Survey
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Financial Concierge</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Profile: {profile.profile_type.replace('_', ' ')}
                    </p>
                </div>
                <button
                    onClick={handleSyncTransactions}
                    disabled={syncing}
                    className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
                >
                    {syncing ? 'Syncing...' : 'Sync Transactions'}
                </button>
            </div>

            {syncResult && (
                <div className={`p-4 rounded-lg ${
                    syncResult.includes('Error') 
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                        : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                }`}>
                    {syncResult}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                    href="/finance/concierge/upload"
                    className="p-6 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                    <h3 className="text-lg font-semibold mb-2">📄 Upload Statement</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Upload PDF or CSV bank statements
                    </p>
                </Link>

                <Link
                    href="/finance/concierge/budget"
                    className="p-6 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                    <h3 className="text-lg font-semibold mb-2">💰 Budget Plan</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        View and manage your budget
                    </p>
                </Link>

                <Link
                    href="/finance/concierge/insights"
                    className="p-6 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                    <h3 className="text-lg font-semibold mb-2">🔍 Insights</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Financial insights and recommendations
                    </p>
                </Link>

                <Link
                    href="/finance/concierge/subscriptions"
                    className="p-6 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                    <h3 className="text-lg font-semibold mb-2">🔄 Subscriptions</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Review and confirm recurring subscriptions
                    </p>
                </Link>
            </div>
        </div>
    );
}

