'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import { PlaidLinkButton } from '@/components/PlaidLinkButton';
import { SpendAlertTestButton } from '@/components/SpendAlertTestButton';

type PlaidItem = {
    id: string;
    item_id: string;
    institution_name: string | null;
    institution_id: string | null;
    created_at: string;
    last_successful_update: string | null;
    error_code: string | null;
    error_message: string | null;
};

export default function IntegrationsPage() {
    const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [backfillLoading, setBackfillLoading] = useState(false);

    // Load connected Plaid items
    useEffect(() => {
        const loadPlaidItems = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('plaid_items')
                    .select('id, item_id, institution_name, institution_id, created_at, last_successful_update, error_code, error_message')
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error loading Plaid items:', error);
                    setNotification('Error loading connected accounts');
                    return;
                }

                setPlaidItems(data || []);
            } catch (err) {
                console.error('Error loading Plaid items:', err);
                setNotification('Error loading connected accounts');
            } finally {
                setLoading(false);
            }
        };

        loadPlaidItems();
    }, []);

    const handleSync = async (plaidItemId: string) => {
        try {
            setSyncing(plaidItemId);
            setNotification(null);

            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                setNotification('Please log in to sync accounts');
                return;
            }

            const response = await fetch('/api/plaid/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plaid_item_id: plaidItemId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to sync');
            }

            const data = await response.json();
            setNotification(
                `Successfully synced ${data.accounts_synced} accounts and ${data.transactions_synced} transactions`
            );

            // Reload Plaid items to update last_successful_update
            const { data: updatedItems } = await supabase
                .from('plaid_items')
                .select('id, item_id, institution_name, institution_id, created_at, last_successful_update, error_code, error_message')
                .order('created_at', { ascending: false });

            if (updatedItems) {
                setPlaidItems(updatedItems);
            }
        } catch (err) {
            console.error('Error syncing:', err);
            setNotification(err instanceof Error ? err.message : 'Failed to sync accounts');
        } finally {
            setSyncing(null);
        }
    };

    const handleDisconnect = async (plaidItemId: string) => {
        if (!window.confirm('Are you sure you want to disconnect this bank account? This will not delete your existing transactions.')) {
            return;
        }

        try {
            setNotification(null);

            const { error } = await supabase
                .from('plaid_items')
                .delete()
                .eq('id', plaidItemId);

            if (error) {
                throw error;
            }

            setNotification('Bank account disconnected');
            setPlaidItems(prev => prev.filter(item => item.id !== plaidItemId));
        } catch (err) {
            console.error('Error disconnecting:', err);
            setNotification('Failed to disconnect bank account');
        }
    };

    const handlePlaidSuccess = () => {
        setNotification('Bank account connected successfully! Syncing accounts and transactions...');
        
        // Reload Plaid items
        const reloadItems = async () => {
            const { data } = await supabase
                .from('plaid_items')
                .select('id, item_id, institution_name, institution_id, created_at, last_successful_update, error_code, error_message')
                .order('created_at', { ascending: false });

            if (data) {
                setPlaidItems(data);
            }
        };

        reloadItems();
    };

    const handleBackfillCategorize = async (plaidOnly: boolean) => {
        const abortController = new AbortController();
        const timeoutMs = 110_000;
        const timeoutId = window.setTimeout(() => abortController.abort(), timeoutMs);

        try {
            setBackfillLoading(true);
            setNotification(null);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setNotification('Please log in');
                return;
            }

            const response = await fetch('/api/finance/categorize-uncategorized', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    limit: 500,
                    plaid_only: plaidOnly,
                    fallback_to_needs_review: !plaidOnly,
                }),
                signal: abortController.signal,
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            setNotification(
                `Categorized ${data.categorized} of ${data.scanned} checked transactions` +
                    (data.still_uncategorized
                        ? ` (${data.still_uncategorized} still need rules or manual categories)`
                        : '') +
                    (data.fallback_categorized
                        ? ` [${data.fallback_categorized} routed to Needs Review]`
                        : '') +
                    (data.hint ? ` ${data.hint}` : '')
            );
        } catch (err) {
            console.error(err);
            if (err instanceof Error && err.name === 'AbortError') {
                setNotification(
                    'Request timed out. Try again — each run processes up to 500 rows. Very large histories may need several runs.'
                );
            } else {
                setNotification(err instanceof Error ? err.message : 'Backfill failed');
            }
        } finally {
            window.clearTimeout(timeoutId);
            setBackfillLoading(false);
        }
    };

    return (
        <section className="space-y-4 px-4 py-4 sm:px-6">
            <div>
                <h2 className="text-lg font-semibold">Bank Integrations</h2>
                <p className="text-xs text-slate-400">
                    Connect your bank accounts to automatically sync transactions
                </p>
            </div>

            {notification && (
                <div className="rounded-md border border-amber-500 bg-amber-950 px-4 py-2 text-xs text-amber-100">
                    {notification}
                </div>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <h3 className="text-sm font-semibold text-white">Spend alerts</h3>
                <p className="mt-1 text-xs text-slate-400">
                    Banner notifications when new transactions sync from Plaid.
                </p>
                <div className="mt-3">
                    <SpendAlertTestButton showSettingsLink />
                </div>
            </div>

            {/* Connect new account */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-2 text-sm font-semibold">Connect Bank Account</h3>
                <p className="mb-4 text-xs text-slate-400">
                    Securely connect your bank account using Plaid to automatically import transactions.
                </p>
                <PlaidLinkButton onSuccess={handlePlaidSuccess} />
            </div>

            {/* Connected accounts */}
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-2 text-sm font-semibold">Connected Accounts</h3>
                {loading ? (
                    <p className="text-xs text-slate-400">Loading...</p>
                ) : plaidItems.length === 0 ? (
                    <p className="text-xs text-slate-400">
                        No bank accounts connected. Connect one above to get started.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {plaidItems.map(item => (
                            <div
                                key={item.id}
                                className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-100">
                                            {item.institution_name || 'Unknown Bank'}
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            Connected: {new Date(item.created_at).toLocaleDateString()}
                                        </div>
                                        {item.last_successful_update && (
                                            <div className="text-[11px] text-slate-400">
                                                Last synced: {new Date(item.last_successful_update).toLocaleDateString()}
                                            </div>
                                        )}
                                        {item.error_code && (
                                            <div className="mt-1 text-[11px] text-red-400">
                                                Error: {item.error_message || item.error_code}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSync(item.id)}
                                            disabled={syncing === item.id}
                                            className="rounded-md border border-emerald-600 bg-emerald-900 px-2 py-1 text-[11px] font-medium text-emerald-100 hover:bg-emerald-800 disabled:opacity-50"
                                        >
                                            {syncing === item.id ? 'Syncing...' : 'Sync'}
                                        </button>
                                        <button
                                            onClick={() => handleDisconnect(item.id)}
                                            className="rounded-md border border-red-700 bg-red-950 px-2 py-1 text-[11px] text-red-200 hover:bg-red-900"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-2 text-sm font-semibold">Categorize existing imports</h3>
                <p className="mb-3 text-xs text-slate-400">
                    Applies your merchant mappings, recurring-item categories, and category rules to transactions that
                    still have no category. For Plaid rows, we also map Plaid personal finance categories to your
                    budget categories when that metadata is present (run <strong>Sync</strong> on a connection once so
                    labels are stored on existing transactions). Run again after you add mappings or rules. Large
                    histories are processed in batches (up to 500 per run; run again to process more).
                </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => handleBackfillCategorize(true)}
                        disabled={backfillLoading}
                        className="rounded-md border border-sky-700 bg-sky-950 px-3 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-900 disabled:opacity-50"
                    >
                        {backfillLoading ? 'Working…' : 'Plaid imports only'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleBackfillCategorize(false)}
                        disabled={backfillLoading}
                        className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                    >
                        {backfillLoading ? 'Working…' : 'All uncategorized'}
                    </button>
                </div>
            </div>
        </section>
    );
}



