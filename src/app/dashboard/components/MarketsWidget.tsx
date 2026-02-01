'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@auth/supabaseClient';

type WatchlistItem = {
    id: string;
    ticker: string;
    asset_type: 'stock' | 'crypto' | 'etf';
    notes: string | null;
};

type Position = {
    id: string;
    ticker: string;
    asset_type: 'stock' | 'crypto' | 'etf';
    quantity: number;
    average_entry: number;
    current_price: number | null;
};

export default function MarketsWidget({ userId }: { userId: string | null }) {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            loadData();
        }
    }, [userId]);

    const loadData = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            // Load watchlist
            const { data: watchlistData } = await supabase
                .from('market_watchlist')
                .select('id, ticker, asset_type, notes')
                .eq('user_id', userId)
                .order('ticker')
                .limit(5);

            // Load positions
            const { data: positionsData } = await supabase
                .from('market_positions')
                .select('id, ticker, asset_type, quantity, average_entry, current_price')
                .eq('user_id', userId)
                .order('ticker')
                .limit(5);

            setWatchlist(watchlistData || []);
            setPositions(positionsData || []);
        } catch (error) {
            console.error('Error loading markets data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateChange = (current: number | null, entry: number): string => {
        if (!current) return 'N/A';
        const change = ((current - entry) / entry) * 100;
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <div className="text-center py-4 text-slate-400 text-sm">Loading...</div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <Link href="/markets" className="hover:underline">
                    <h3 className="text-lg font-semibold">Markets</h3>
                </Link>
            </div>

            {/* Watchlist */}
            {watchlist.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase">Watchlist</div>
                    <div className="space-y-1">
                        {watchlist.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                                <span className="text-white font-medium">{item.ticker}</span>
                                <span className="text-slate-400 text-xs">{item.asset_type}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Positions */}
            {positions.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase">Positions</div>
                    <div className="space-y-1">
                        {positions.map((pos) => {
                            const change = calculateChange(pos.current_price, pos.average_entry);
                            const isPositive = pos.current_price && pos.current_price >= pos.average_entry;
                            return (
                                <div key={pos.id} className="flex items-center justify-between text-sm">
                                    <span className="text-white font-medium">{pos.ticker}</span>
                                    <span className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                        {change}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {watchlist.length === 0 && positions.length === 0 && (
                <p className="text-xs text-slate-500">No watchlist or positions</p>
            )}

            <div className="pt-2 border-t border-slate-700">
                <Link
                    href="/markets"
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                    View full Markets →
                </Link>
            </div>
        </div>
    );
}
