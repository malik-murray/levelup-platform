'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import Link from 'next/link';
import { getTierColor } from '@/lib/markets/swingPlaybook';

type Alert = {
    id: string;
    ticker: string;
    tier: 'Strong Buy' | 'Buy' | 'Neutral' | 'Take Profit' | 'Strong Sell' | 'High-Risk Avoid';
    buy_score: number;
    sell_score: number;
    risk_score: number;
    market_regime: 'bull' | 'bear' | 'range';
    current_price: number;
    read: boolean;
    created_at: string;
};

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [alertsEnabled, setAlertsEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        loadAlerts();
        checkAlertsEnabled();
    }, []);

    const checkAlertsEnabled = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Select all columns in case eth_swing_alerts_enabled doesn't exist yet
            const { data, error } = await supabase
                .from('market_user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - settings don't exist yet, alerts are disabled
                    setAlertsEnabled(false);
                } else if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
                    // Column doesn't exist - migration hasn't been run
                    console.error('Column eth_swing_alerts_enabled does not exist. Please run migration 012_market_alerts.sql');
                    setAlertsEnabled(null); // Set to null to show special message
                } else {
                    console.error('Error checking alerts enabled:', error);
                    setAlertsEnabled(false);
                }
            } else {
                // Column exists, check the value
                setAlertsEnabled(data?.eth_swing_alerts_enabled === true);
            }
        } catch (error: any) {
            console.error('Error checking alerts enabled:', error);
            if (error?.code === '42703' || error?.message?.includes('column') || error?.message?.includes('does not exist')) {
                setAlertsEnabled(null); // Migration not run
            } else {
                setAlertsEnabled(false);
            }
        }
    };

    const loadAlerts = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const { data, error } = await supabase
                .from('market_alerts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Error loading alerts:', error);
                
                // Check if table doesn't exist (migration not run)
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    setNotification('The alerts table has not been created yet. Please run the database migration (012_market_alerts.sql) in Supabase.');
                } else {
                    setNotification(`Error loading alerts: ${error.message || 'Check console for details'}.`);
                }
            } else {
                setAlerts(data || []);
            }
        } catch (error) {
            console.error('Error loading alerts:', error);
            setNotification('Error loading alerts. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (alertId: string) => {
        try {
            const { error } = await supabase
                .from('market_alerts')
                .update({ read: true })
                .eq('id', alertId);

            if (error) {
                console.error('Error marking alert as read:', error);
                setNotification('Error updating alert.');
            } else {
                setAlerts(prev =>
                    prev.map(alert => (alert.id === alertId ? { ...alert, read: true } : alert))
                );
            }
        } catch (error) {
            console.error('Error marking alert as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('market_alerts')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);

            if (error) {
                console.error('Error marking all alerts as read:', error);
                setNotification('Error updating alerts.');
            } else {
                setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
                setNotification('All alerts marked as read.');
                setTimeout(() => setNotification(null), 3000);
            }
        } catch (error) {
            console.error('Error marking all alerts as read:', error);
        }
    };

    const deleteAlert = async (alertId: string) => {
        try {
            const { error } = await supabase.from('market_alerts').delete().eq('id', alertId);

            if (error) {
                console.error('Error deleting alert:', error);
                setNotification('Error deleting alert.');
            } else {
                setAlerts(prev => prev.filter(alert => alert.id !== alertId));
            }
        } catch (error) {
            console.error('Error deleting alert:', error);
        }
    };

    const unreadCount = alerts.filter(a => !a.read).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-600 dark:text-slate-400">Loading alerts...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Market Alerts</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Get notified when ETH-USD crosses into Strong Buy or Strong Sell tiers.
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="text-sm px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Mark All Read ({unreadCount})
                    </button>
                )}
            </div>

            {/* Notification */}
            {notification && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                    {notification}
                    <button
                        onClick={() => setNotification(null)}
                        className="float-right font-medium hover:underline"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Alerts List */}
            {alerts.length === 0 && !loading ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 dark:text-slate-400">
                    {alertsEnabled === true ? (
                        <>
                            <p className="font-medium text-slate-700 dark:text-slate-300">No alerts yet.</p>
                            <p className="text-sm mt-2">
                                Alerts will appear here when ETH-USD crosses into{' '}
                                <span className="font-semibold">Strong Buy</span> or{' '}
                                <span className="font-semibold">Strong Sell</span> tiers.
                            </p>
                            <p className="text-xs mt-3 text-slate-400 dark:text-slate-500">
                                <span className="inline-block px-2 py-1 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-medium mb-2">
                                    ✓ Alerts Enabled
                                </span>
                                <br />
                                Try analyzing{' '}
                                <Link href="/markets/ETH" className="text-amber-600 dark:text-amber-400 hover:underline">
                                    ETH
                                </Link>{' '}
                                in Swing mode to see if alerts are triggered.
                            </p>
                        </>
                    ) : alertsEnabled === false ? (
                        <>
                            <p>No alerts yet.</p>
                            <p className="text-sm mt-1">
                                Enable{' '}
                                <Link href="/markets/settings" className="text-amber-600 dark:text-amber-400 hover:underline">
                                    ETH Swing Alerts
                                </Link>{' '}
                                in settings to get notified of tier changes.
                            </p>
                        </>
                    ) : alertsEnabled === null ? (
                        <>
                            <p className="font-medium text-slate-700 dark:text-slate-300">Database Migration Required</p>
                            <p className="text-sm mt-2">
                                The alerts feature requires a database migration to be run.
                            </p>
                            <p className="text-xs mt-2 text-slate-400 dark:text-slate-500">
                                Please run the migration file <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">012_market_alerts.sql</code> in Supabase.
                            </p>
                        </>
                    ) : (
                        <>
                            <p>Checking alert settings...</p>
                        </>
                    )}
                </div>
            ) : alerts.length === 0 && loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-slate-600 dark:text-slate-400">Loading alerts...</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map(alert => {
                        const tierColors = getTierColor(alert.tier);
                        const displayTicker = alert.ticker === 'ETH-USD' ? 'ETH' : alert.ticker;

                        return (
                            <div
                                key={alert.id}
                                className={`rounded-lg border p-4 ${
                                    alert.read
                                        ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75'
                                        : `${tierColors.border} ${tierColors.bg}`
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Link
                                                href={`/markets/${displayTicker}`}
                                                className="text-lg font-semibold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400"
                                            >
                                                {displayTicker}
                                            </Link>
                                            {!alert.read && (
                                                <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                                            )}
                                        </div>
                                        
                                        <div className={`inline-block px-3 py-1 rounded text-sm font-semibold mb-2 ${tierColors.text} ${!alert.read ? tierColors.bg : 'bg-slate-100 dark:bg-slate-800'}`}>
                                            {alert.tier}
                                        </div>
                                        
                                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mt-2">
                                            <div>
                                                Price: ${alert.current_price.toFixed(2)} • Regime: {alert.market_regime.toUpperCase()}
                                            </div>
                                            <div>
                                                Buy: {alert.buy_score.toFixed(1)}/10 • Sell: {alert.sell_score.toFixed(1)}/10 • Risk: {alert.risk_score}/100
                                            </div>
                                            <div>
                                                {new Date(alert.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2">
                                        {!alert.read && (
                                            <button
                                                onClick={() => markAsRead(alert.id)}
                                                className="text-xs px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                Mark Read
                                            </button>
                                        )}
                                        <Link
                                            href={`/markets/${displayTicker}`}
                                            className="text-xs px-3 py-1 rounded-md bg-amber-500 dark:bg-amber-400 text-black hover:bg-amber-600 dark:hover:bg-amber-300 transition-colors text-center"
                                        >
                                            View
                                        </Link>
                                        <button
                                            onClick={() => deleteAlert(alert.id)}
                                            className="text-xs px-3 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

