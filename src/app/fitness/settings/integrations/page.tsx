'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import { connectIntegration, disconnectIntegration } from '@/lib/fitnessIntegrations';

type Integration = {
    id: string;
    provider: string;
    status: 'connected' | 'disconnected' | 'coming_soon';
    last_synced_at: string | null;
};

const availableProviders = [
    { key: 'apple_health', name: 'Apple Health / Apple Watch', comingSoon: true },
    { key: 'fitbit', name: 'Fitbit', comingSoon: true },
    { key: 'myfitnesspal', name: 'MyFitnessPal', comingSoon: true },
    { key: 'cronometer', name: 'Cronometer', comingSoon: true },
];

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);

    useEffect(() => {
        loadIntegrations();
    }, []);

    const loadIntegrations = async () => {
        setLoading(true);
        setNotification(null);

        try {
            // Get authenticated user
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                window.location.href = '/login';
                return;
            }

            const { data, error } = await supabase
                .from('fitness_integrations')
                .select('*')
                .eq('user_id', authUser.id)
                .order('provider');

            if (error) throw error;

            // Create integrations for all providers, defaulting to disconnected or coming_soon
            const existingIntegrations = (data as Integration[]) || [];
            const providerMap = new Map(existingIntegrations.map(i => [i.provider, i]));

            const allIntegrations = availableProviders.map(provider => {
                const existing = providerMap.get(provider.key);
                return existing || {
                    id: '',
                    provider: provider.key,
                    status: provider.comingSoon ? ('coming_soon' as const) : ('disconnected' as const),
                    last_synced_at: null,
                };
            });

            setIntegrations(allIntegrations);
        } catch (error) {
            console.error('Error loading integrations:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to load integrations');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (provider: string, currentStatus: string) => {
        if (currentStatus === 'coming_soon') {
            setNotification(`${provider} integration is coming soon!`);
            return;
        }

        setToggling(provider);
        setNotification(null);

        try {
            if (currentStatus === 'disconnected') {
                await connectIntegration(provider);
                setNotification(`${provider} connected successfully!`);
            } else {
                await disconnectIntegration(provider);
                setNotification(`${provider} disconnected successfully!`);
            }
            await loadIntegrations();
        } catch (error) {
            console.error(`Error toggling ${provider}:`, error);
            setNotification(error instanceof Error ? error.message : `Failed to toggle ${provider}`);
        } finally {
            setToggling(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected':
                return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400';
            case 'coming_soon':
                return 'border-slate-500/30 bg-slate-950/20 text-slate-400';
            default:
                return 'border-slate-800 bg-slate-900 text-slate-300';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'connected':
                return 'Connected';
            case 'coming_soon':
                return 'Coming Soon';
            default:
                return 'Disconnected';
        }
    };

    return (
        <section className="space-y-6 px-6 py-4">
            {notification && (
                <div className={`rounded-lg border p-3 text-xs ${
                    notification.includes('Error') || notification.includes('Failed')
                        ? 'border-red-500/30 bg-red-950/20 text-red-400'
                        : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                }`}>
                    {notification}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white dark:text-white">Integrations</h2>
                    <p className="text-xs text-slate-400 mt-1">Connect your fitness and nutrition apps</p>
                </div>
            </div>

            {/* Integrations List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : (
                    integrations.map(integration => {
                        const providerInfo = availableProviders.find(p => p.key === integration.provider);
                        const canToggle = integration.status !== 'coming_soon';

                        return (
                            <div
                                key={integration.provider}
                                className={`rounded-lg border p-4 ${getStatusColor(integration.status)}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-sm font-semibold text-white dark:text-white">
                                                {providerInfo?.name || integration.provider}
                                            </h3>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                integration.status === 'connected'
                                                    ? 'bg-emerald-400 text-black'
                                                    : integration.status === 'coming_soon'
                                                    ? 'bg-slate-700 text-slate-300'
                                                    : 'bg-slate-800 text-slate-400'
                                            }`}>
                                                {getStatusLabel(integration.status)}
                                            </span>
                                        </div>
                                        {integration.status === 'connected' && integration.last_synced_at && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                Last synced: {new Date(integration.last_synced_at).toLocaleString()}
                                            </p>
                                        )}
                                        {integration.status === 'coming_soon' && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                This integration will be available soon
                                            </p>
                                        )}
                                        {integration.status === 'disconnected' && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                Connect to automatically sync workouts and meals
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleToggle(integration.provider, integration.status)}
                                        disabled={!canToggle || toggling === integration.provider}
                                        className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors ${
                                            integration.status === 'connected'
                                                ? 'bg-red-900 text-red-200 hover:bg-red-800'
                                                : integration.status === 'coming_soon'
                                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                : 'bg-amber-400 text-black hover:bg-amber-300'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {toggling === integration.provider
                                            ? 'Connecting...'
                                            : integration.status === 'connected'
                                            ? 'Disconnect'
                                            : integration.status === 'coming_soon'
                                            ? 'Coming Soon'
                                            : 'Connect'}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Info Box */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
                <h3 className="text-xs font-semibold text-amber-400 mb-2">About Integrations</h3>
                <p className="text-xs text-slate-300">
                    Connect your fitness and nutrition apps to automatically sync workouts, meals, and metrics.
                    For now, integrations are in mock/testing mode. Real API connections will be added in future updates.
                </p>
            </div>
        </section>
    );
}








