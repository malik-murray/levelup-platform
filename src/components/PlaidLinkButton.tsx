'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { supabase } from '@auth/supabaseClient';

interface PlaidLinkButtonProps {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

export function PlaidLinkButton({ onSuccess, onError }: PlaidLinkButtonProps) {
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch link token from API
    useEffect(() => {
        // Clear any previous errors on mount/refresh
        setError(null);
        
        const fetchLinkToken = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (!session) {
                    setError('Please log in to connect your bank account');
                    return;
                }

                const response = await fetch('/api/plaid/create-link-token', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    const errorMessage = errorData.error || 'Failed to create Link token';
                    const errorDetails = errorData.details ? ` (${errorData.details})` : '';
                    
                    // Log the full error for debugging
                    console.log('Plaid API Error:', { errorMessage, errorData, status: response.status });
                    
                    // Handle configuration errors gracefully
                    if (errorMessage.includes('not configured') || errorMessage.includes('Plaid Client ID') || errorMessage.includes('Plaid Secret')) {
                        setError(`Plaid integration is not configured. ${errorDetails}`);
                        return;
                    }
                    
                    setError(`${errorMessage}${errorDetails}`);
                    return;
                }

                const data = await response.json();
                setLinkToken(data.link_token);
                setError(null); // Clear error on success
            } catch (err) {
                console.error('Error fetching Link token:', err);
                setError(err instanceof Error ? err.message : 'Failed to initialize Plaid Link');
                if (onError) {
                    onError(err instanceof Error ? err : new Error('Unknown error'));
                }
            }
        };

        fetchLinkToken();
    }, [onError]);

    // Handle successful Plaid Link connection
    const onPlaidSuccess = useCallback(
        async (publicToken: string, metadata: any) => {
            setLoading(true);
            setError(null);

            try {
                const { data: { session } } = await supabase.auth.getSession();
                
                if (!session) {
                    throw new Error('Session expired. Please log in again.');
                }

                // Exchange public token for access token
                const exchangeResponse = await fetch('/api/plaid/exchange-public-token', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ public_token: publicToken }),
                });

                if (!exchangeResponse.ok) {
                    const errorData = await exchangeResponse.json();
                    throw new Error(errorData.error || 'Failed to exchange public token');
                }

                const exchangeData = await exchangeResponse.json();

                // Automatically sync accounts and transactions
                const syncResponse = await fetch('/api/plaid/sync', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ plaid_item_id: exchangeData.plaid_item_id }),
                });

                if (!syncResponse.ok) {
                    const errorData = await syncResponse.json();
                    console.warn('Sync failed:', errorData);
                    // Don't throw - the connection was successful, sync can be retried
                }

                if (onSuccess) {
                    onSuccess();
                }
            } catch (err) {
                console.error('Error processing Plaid connection:', err);
                const errorMessage = err instanceof Error ? err.message : 'Failed to connect bank account';
                setError(errorMessage);
                if (onError) {
                    onError(err instanceof Error ? err : new Error('Unknown error'));
                }
            } finally {
                setLoading(false);
            }
        },
        [onSuccess, onError]
    );

    const { open, ready } = usePlaidLink({
        token: linkToken,
        onSuccess: onPlaidSuccess,
        onExit: (err, metadata) => {
            if (err) {
                console.error('Plaid Link exit error:', err);
                setError(err.error_message || 'Connection cancelled');
            }
        },
    });

    const handleClick = () => {
        if (ready && linkToken) {
            open();
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleClick}
                disabled={!ready || loading || !linkToken}
                className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {loading ? 'Connecting...' : 'Connect Bank Account'}
            </button>
            {error && (
                <div className="rounded-md border border-red-600 bg-red-950 px-3 py-1.5 text-xs text-red-200">
                    {error}
                </div>
            )}
        </div>
    );
}



