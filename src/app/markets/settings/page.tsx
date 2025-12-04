'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import { AnalysisMode } from '@/lib/markets/types';
import { MODE_CONFIGS } from '@/lib/markets/modes';

type UserSettings = {
    default_mode: AnalysisMode;
    risk_tolerance: 'low' | 'medium' | 'high';
    notifications_enabled: boolean;
    eth_swing_alerts_enabled: boolean;
};

export default function MarketsSettingsPage() {
    const [settings, setSettings] = useState<UserSettings>({
        default_mode: 'long-term',
        risk_tolerance: 'medium',
        notifications_enabled: false,
        eth_swing_alerts_enabled: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            const { data, error } = await supabase
                .from('market_user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = no rows returned (expected if settings don't exist yet)
                console.error('Error loading settings:', error);
                setNotification('Error loading settings. Using defaults.');
            } else if (data) {
                setSettings({
                    default_mode: data.default_mode || 'long-term',
                    risk_tolerance: data.risk_tolerance || 'medium',
                    notifications_enabled: data.notifications_enabled || false,
                    eth_swing_alerts_enabled: data.eth_swing_alerts_enabled || false,
                });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            setNotification('Error loading settings. Using defaults.');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('market_user_settings')
                .upsert({
                    user_id: user.id,
                    default_mode: settings.default_mode,
                    risk_tolerance: settings.risk_tolerance,
                    notifications_enabled: settings.notifications_enabled,
                    eth_swing_alerts_enabled: settings.eth_swing_alerts_enabled,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id',
                });

            if (error) {
                console.error('Error saving settings:', error);
                setNotification('Error saving settings: ' + error.message);
            } else {
                setNotification('Settings saved successfully!');
                setTimeout(() => setNotification(null), 3000);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            setNotification('Error saving settings. Check console for details.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-600 dark:text-slate-400">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Configure your analyzer preferences and defaults.
                </p>
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

            {/* Default Mode */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Default Analysis Mode
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Choose your default analysis mode. You can change this per-ticker when analyzing.
                </p>
                <div className="space-y-3">
                    {Object.values(MODE_CONFIGS).map(modeConfig => (
                        <label
                            key={modeConfig.name}
                            className="flex items-start gap-3 p-3 rounded-md border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <input
                                type="radio"
                                name="default_mode"
                                value={modeConfig.name}
                                checked={settings.default_mode === modeConfig.name}
                                onChange={(e) =>
                                    setSettings({ ...settings, default_mode: e.target.value as AnalysisMode })
                                }
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                    {modeConfig.displayName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {modeConfig.description}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Risk Tolerance */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Risk Tolerance
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    This affects position sizing suggestions and risk warnings.
                </p>
                <div className="space-y-3">
                    {(['low', 'medium', 'high'] as const).map(tolerance => (
                        <label
                            key={tolerance}
                            className="flex items-start gap-3 p-3 rounded-md border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <input
                                type="radio"
                                name="risk_tolerance"
                                value={tolerance}
                                checked={settings.risk_tolerance === tolerance}
                                onChange={(e) =>
                                    setSettings({
                                        ...settings,
                                        risk_tolerance: e.target.value as 'low' | 'medium' | 'high',
                                    })
                                }
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                                    {tolerance} Risk
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {tolerance === 'low' &&
                                        'Conservative approach. Prefer low-volatility assets and smaller positions.'}
                                    {tolerance === 'medium' &&
                                        'Balanced approach. Moderate positions in diversified assets.'}
                                    {tolerance === 'high' &&
                                        'Aggressive approach. Comfortable with higher volatility and larger positions.'}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Notifications */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                    Notifications
                </div>
                
                <div className="space-y-4">
                    {/* General Notifications */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                General Notifications
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Get alerts when your positions or watchlist items hit important thresholds.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.notifications_enabled}
                                onChange={(e) =>
                                    setSettings({ ...settings, notifications_enabled: e.target.checked })
                                }
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500 dark:peer-checked:bg-amber-400" />
                        </label>
                    </div>
                    
                    {/* ETH Swing Alerts */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                ETH Swing Alerts
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Get alerts when ETH-USD crosses into Strong Buy or Strong Sell tiers in Swing mode.
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.eth_swing_alerts_enabled}
                                onChange={(e) =>
                                    setSettings({ ...settings, eth_swing_alerts_enabled: e.target.checked })
                                }
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500 dark:peer-checked:bg-amber-400" />
                        </label>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="px-6 py-2 rounded-md bg-amber-500 dark:bg-amber-400 text-black font-medium hover:bg-amber-600 dark:hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}

