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
    last_webhook_at: string | null;
    last_cron_sync_at: string | null;
    error_code: string | null;
    error_message: string | null;
};

const PLAID_ITEM_SELECT =
    'id, item_id, institution_name, institution_id, created_at, last_successful_update, last_webhook_at, last_cron_sync_at, error_code, error_message';

const STALE_SYNC_MS = 24 * 60 * 60 * 1000;
const AUTO_FIX_STORAGE_KEY = 'plaid-integrations-auto-fix-at';

function formatSyncTimestamp(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function isSyncStale(lastUpdate: string | null): boolean {
    if (!lastUpdate) return true;
    return Date.now() - new Date(lastUpdate).getTime() > STALE_SYNC_MS;
}

export default function IntegrationsPage() {
    const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [backfillLoading, setBackfillLoading] = useState(false);
    const [recentBackfillLoading, setRecentBackfillLoading] = useState(false);
    const [registeringWebhooks, setRegisteringWebhooks] = useState(false);

    // Load connected Plaid items
    useEffect(() => {
        const loadPlaidItems = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('plaid_items')
                    .select(PLAID_ITEM_SELECT)
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

    // If sync is stale, re-register webhooks and pull once per day when visiting this page
    useEffect(() => {
        if (loading || plaidItems.length === 0) return;

        const anyStale = plaidItems.some(item => isSyncStale(item.last_successful_update));
        if (!anyStale) return;

        const lastFix = localStorage.getItem(AUTO_FIX_STORAGE_KEY);
        if (lastFix && Date.now() - Number(lastFix) < STALE_SYNC_MS) return;

        const runAutoFix = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) return;

            try {
                await fetch('/api/plaid/register-webhooks', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                const syncRes = await fetch('/api/plaid/sync-all', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ register_webhooks: false, request_refresh: true }),
                });
                if (syncRes.ok) {
                    localStorage.setItem(AUTO_FIX_STORAGE_KEY, String(Date.now()));
                    const { data } = await supabase
                        .from('plaid_items')
                        .select(PLAID_ITEM_SELECT)
                        .order('created_at', { ascending: false });
                    if (data) setPlaidItems(data);
                }
            } catch {
                // User can still use Enable automatic sync / Sync
            }
        };

        void runAutoFix();
    }, [loading, plaidItems]);

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
                data.skipped
                    ? 'Sync already in progress'
                    : `Synced ${data.accounts_synced} accounts; ${data.transactions_synced} new transaction(s)${
                          data.pending_inserted > 0 ? ` (${data.pending_inserted} pending)` : ''
                      }${
                          data.refresh_requested
                              ? '. Requested fresh pull from bank — if still missing, wait a few minutes and sync again.'
                              : ''
                      }`
            );

            // Reload Plaid items to update last_successful_update
            const { data: updatedItems } = await supabase
                .from('plaid_items')
                .select(PLAID_ITEM_SELECT)
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

    const handleEnableAutomaticSync = async () => {
        try {
            setRegisteringWebhooks(true);
            setNotification(null);

            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
                setNotification('Please log in');
                return;
            }

            const response = await fetch('/api/plaid/register-webhooks', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to register webhooks');
            }

            const syncRes = await fetch('/api/plaid/sync-all', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ register_webhooks: false, request_refresh: true }),
            });
            const syncData = await syncRes.json().catch(() => ({}));

            const { data: refreshed } = await supabase
                .from('plaid_items')
                .select(PLAID_ITEM_SELECT)
                .order('created_at', { ascending: false });
            if (refreshed) setPlaidItems(refreshed);

            localStorage.setItem(AUTO_FIX_STORAGE_KEY, String(Date.now()));

            if (!syncRes.ok) {
                const syncErr =
                    syncData?.error ||
                    syncData?.message ||
                    `HTTP ${syncRes.status}`;
                setNotification(
                    (data.message || `Registered automatic sync on ${data.registered} account(s).`) +
                        ` Sync-all failed: ${syncErr}`
                );
                return;
            }

            const syncNote =
                syncRes.ok && syncData.transactions_added > 0
                    ? ` Pulled ${syncData.transactions_added} new transaction(s)${
                          syncData.pending_inserted > 0
                              ? ` (${syncData.pending_inserted} pending).`
                              : '.'
                      }`
                    : syncRes.ok && syncData.pending_inserted > 0
                      ? ` Pulled ${syncData.pending_inserted} pending transaction(s).`
                      : syncRes.ok
                        ? ' Plaid had no new transactions yet — banks can take hours for pending purchases.'
                        : '';
            setNotification(
                (data.message || `Registered automatic sync on ${data.registered} account(s).`) + syncNote
            );
        } catch (err) {
            setNotification(err instanceof Error ? err.message : 'Failed to enable automatic sync');
        } finally {
            setRegisteringWebhooks(false);
        }
    };

    const handleBackfillRecent = async () => {
        try {
            setRecentBackfillLoading(true);
            setNotification(null);

            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
                setNotification('Please log in');
                return;
            }

            const response = await fetch('/api/plaid/backfill-recent', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ days: 14 }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Backfill failed');
            }

            const { data: refreshed } = await supabase
                .from('plaid_items')
                .select(PLAID_ITEM_SELECT)
                .order('created_at', { ascending: false });
            if (refreshed) setPlaidItems(refreshed);

            setNotification(data.message || 'Recent backfill completed');
        } catch (err) {
            setNotification(err instanceof Error ? err.message : 'Backfill failed');
        } finally {
            setRecentBackfillLoading(false);
        }
    };

    const handlePlaidSuccess = () => {
        setNotification('Bank account connected successfully! Syncing accounts and transactions...');
        
        // Reload Plaid items
        const reloadItems = async () => {
            const { data } = await supabase
                .from('plaid_items')
                .select(PLAID_ITEM_SELECT)
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

            {plaidItems.length > 0 ? (
                <div className="rounded-lg border border-amber-900/50 bg-amber-950/40 p-4">
                    <h3 className="text-sm font-semibold text-amber-100">Automatic sync</h3>
                    <p className="mt-1 text-xs text-amber-200/80">
                        <strong>While the app is closed:</strong> our server checks Plaid every 10 minutes and
                        sends push alerts when new transactions arrive (requires <code className="text-amber-100">CRON_SECRET</code>{' '}
                        on Vercel). <strong>While the app is open:</strong> we also poll every few minutes. Plaid
                        webhooks (registered below) are the fastest path when your bank sends data.
                    </p>
                    <button
                        type="button"
                        onClick={handleEnableAutomaticSync}
                        disabled={registeringWebhooks || recentBackfillLoading || loading}
                        className="mt-3 w-full rounded-lg border border-amber-600 bg-amber-900/80 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-800 disabled:opacity-50"
                    >
                        {registeringWebhooks ? 'Enabling…' : 'Enable automatic sync'}
                    </button>
                    <button
                        type="button"
                        onClick={handleBackfillRecent}
                        disabled={recentBackfillLoading || registeringWebhooks || loading}
                        className="mt-2 w-full rounded-lg border border-sky-700 bg-sky-900/70 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-800 disabled:opacity-50"
                    >
                        {recentBackfillLoading ? 'Backfilling…' : 'Backfill missing recent transactions (14 days)'}
                    </button>
                </div>
            ) : null}

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
                                        {item.last_successful_update ? (
                                            <div
                                                className={`text-[11px] ${
                                                    isSyncStale(item.last_successful_update)
                                                        ? 'text-amber-400'
                                                        : 'text-slate-400'
                                                }`}
                                            >
                                                Last synced:{' '}
                                                {formatSyncTimestamp(item.last_successful_update)}
                                                {isSyncStale(item.last_successful_update)
                                                    ? ' — stale, open Finance or tap Sync'
                                                    : ''}
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-amber-400">
                                                Never synced — tap Sync or Enable automatic sync
                                            </div>
                                        )}
                                        {item.last_webhook_at ? (
                                            <div className="text-[11px] text-slate-500">
                                                Last Plaid webhook:{' '}
                                                {formatSyncTimestamp(item.last_webhook_at)}
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-slate-500">
                                                No Plaid webhooks received yet
                                            </div>
                                        )}
                                        {item.last_cron_sync_at ? (
                                            <div className="text-[11px] text-slate-500">
                                                Last server sync (app closed):{' '}
                                                {formatSyncTimestamp(item.last_cron_sync_at)}
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-amber-500">
                                                Server background sync has not run — check CRON_SECRET on Vercel
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



