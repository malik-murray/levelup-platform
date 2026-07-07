'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    connectFitbit,
    disconnectFitbit,
    loadFitnessConnections,
    syncFitbit,
    type FitnessConnectionSummary,
} from '@/lib/fitnessIntegrations';

type ProviderConfig = {
    key: string;
    name: string;
    description: string;
    comingSoon: boolean;
    supportsOAuth: boolean;
};

const availableProviders: ProviderConfig[] = [
    {
        key: 'apple_health',
        name: 'Apple Health / Apple Watch',
        description: 'Requires the LevelUp mobile app to read HealthKit data.',
        comingSoon: true,
        supportsOAuth: false,
    },
    {
        key: 'fitbit',
        name: 'Fitbit',
        description: 'Sync steps, sleep, heart rate, weight, and workouts automatically.',
        comingSoon: false,
        supportsOAuth: true,
    },
    {
        key: 'health_connect',
        name: 'Google Health Connect',
        description: 'Requires the LevelUp Android app to read on-device health data.',
        comingSoon: true,
        supportsOAuth: false,
    },
    {
        key: 'myfitnesspal',
        name: 'MyFitnessPal',
        description: 'Import meals and nutrition data.',
        comingSoon: true,
        supportsOAuth: false,
    },
    {
        key: 'cronometer',
        name: 'Cronometer',
        description: 'Import detailed nutrition logs.',
        comingSoon: true,
        supportsOAuth: false,
    },
];

function formatSyncTimestamp(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function IntegrationsPage() {
    const searchParams = useSearchParams();
    const [connections, setConnections] = useState<FitnessConnectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadConnections = useCallback(async () => {
        setLoading(true);
        setNotification(null);

        try {
            const data = await loadFitnessConnections();
            setConnections(data);
        } catch (error) {
            console.error('Error loading integrations:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to load integrations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadConnections();
    }, [loadConnections]);

    useEffect(() => {
        const fitbitStatus = searchParams.get('fitbit');
        if (!fitbitStatus) return;

        if (fitbitStatus === 'connected') {
            setNotification('Fitbit connected! Your health data is syncing.');
            if (searchParams.get('webhook_warning')) {
                setNotification(
                    'Fitbit connected and initial sync started. Webhook setup may need a retry from Sync Now.'
                );
            }
            void loadConnections();
        } else if (fitbitStatus === 'error') {
            const message = searchParams.get('message') ?? 'Connection failed';
            setNotification(`Fitbit connection failed: ${message}`);
        }

        window.history.replaceState({}, '', '/fitness/settings/integrations');
    }, [searchParams, loadConnections]);

    const getConnection = (provider: string) =>
        connections.find(connection => connection.provider === provider);

    const handleConnect = async (provider: ProviderConfig) => {
        if (provider.comingSoon) {
            setNotification(`${provider.name} is coming soon`);
            return;
        }

        if (provider.key === 'fitbit') {
            connectFitbit();
            return;
        }

        setNotification(`${provider.name} is not available yet`);
    };

    const handleDisconnect = async (provider: ProviderConfig) => {
        setActionLoading(`disconnect-${provider.key}`);
        setNotification(null);

        try {
            if (provider.key === 'fitbit') {
                await disconnectFitbit();
                setNotification('Fitbit disconnected');
            }
            await loadConnections();
        } catch (error) {
            setNotification(error instanceof Error ? error.message : 'Disconnect failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSync = async (provider: ProviderConfig) => {
        setActionLoading(`sync-${provider.key}`);
        setNotification(null);

        try {
            if (provider.key === 'fitbit') {
                const message = await syncFitbit();
                setNotification(message);
            }
            await loadConnections();
        } catch (error) {
            setNotification(error instanceof Error ? error.message : 'Sync failed');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusColor = (status: string, hasError: boolean) => {
        if (hasError) return 'border-red-500/30 bg-red-950/20 text-red-300';
        switch (status) {
            case 'connected':
                return 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400';
            case 'coming_soon':
                return 'border-slate-500/30 bg-slate-950/20 text-slate-400';
            default:
                return 'border-slate-800 bg-slate-900 text-slate-300';
        }
    };

    const getStatusLabel = (connection: FitnessConnectionSummary | undefined, comingSoon: boolean) => {
        if (comingSoon) return 'Coming Soon';
        if (connection?.error_code) return 'Needs attention';
        if (connection?.status === 'connected') return 'Connected';
        return 'Disconnected';
    };

    return (
        <div className="max-w-2xl space-y-6">
            {notification && (
                <div
                    className={`rounded-lg border p-3 text-xs ${
                        notification.includes('failed') || notification.includes('Failed')
                            ? 'border-red-500/30 bg-red-950/20 text-red-400'
                            : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                    }`}
                >
                    {notification}
                </div>
            )}

            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Integrations</h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Connect fitness and nutrition apps to keep your metrics up to date automatically
                </p>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-xs text-slate-400">Loading...</div>
                ) : (
                    availableProviders.map(provider => {
                        const connection = getConnection(provider.key);
                        const isConnected = connection?.status === 'connected';
                        const hasError = Boolean(connection?.error_code);
                        const canConnect = !provider.comingSoon && provider.supportsOAuth;

                        return (
                            <div
                                key={provider.key}
                                className={`rounded-lg border p-4 ${getStatusColor(
                                    connection?.status ?? 'disconnected',
                                    hasError
                                )}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="mb-1 flex items-center gap-3">
                                            <h3 className="text-sm font-semibold text-white">
                                                {provider.name}
                                            </h3>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    isConnected && !hasError
                                                        ? 'bg-emerald-400 text-black'
                                                        : hasError
                                                          ? 'bg-red-800 text-red-100'
                                                          : provider.comingSoon
                                                            ? 'bg-slate-700 text-slate-300'
                                                            : 'bg-slate-800 text-slate-400'
                                                }`}
                                            >
                                                {getStatusLabel(connection, provider.comingSoon)}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-400">{provider.description}</p>

                                        {isConnected && connection?.last_synced_at && (
                                            <p className="mt-2 text-xs text-slate-400">
                                                Last synced: {formatSyncTimestamp(connection.last_synced_at)}
                                            </p>
                                        )}

                                        {hasError && connection?.error_message && (
                                            <p className="mt-2 text-xs text-red-300">
                                                {connection.error_message}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {isConnected ? (
                                            <>
                                                <button
                                                    onClick={() => void handleSync(provider)}
                                                    disabled={actionLoading === `sync-${provider.key}`}
                                                    className="rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {actionLoading === `sync-${provider.key}`
                                                        ? 'Syncing...'
                                                        : 'Sync Now'}
                                                </button>
                                                <button
                                                    onClick={() => void handleDisconnect(provider)}
                                                    disabled={
                                                        actionLoading === `disconnect-${provider.key}`
                                                    }
                                                    className="rounded-md bg-red-900 px-4 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {actionLoading === `disconnect-${provider.key}`
                                                        ? 'Disconnecting...'
                                                        : 'Disconnect'}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => void handleConnect(provider)}
                                                disabled={!canConnect || actionLoading !== null}
                                                className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                                    canConnect
                                                        ? 'bg-amber-400 text-black hover:bg-amber-300'
                                                        : 'bg-slate-800 text-slate-500'
                                                }`}
                                            >
                                                {provider.comingSoon ? 'Coming Soon' : 'Connect'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
                <h3 className="mb-2 text-xs font-semibold text-amber-400">How syncing works</h3>
                <ul className="space-y-1 text-xs text-slate-300">
                    <li>Fitbit syncs steps, sleep, resting heart rate, weight, and workouts.</li>
                    <li>Data appears on your Fitness dashboard and Metrics page automatically.</li>
                    <li>Background sync runs every 15 minutes when connected.</li>
                    <li>Google Health Connect and Apple Health require a mobile companion app.</li>
                </ul>
            </div>
        </div>
    );
}
