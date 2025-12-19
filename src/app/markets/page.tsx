'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@auth/supabaseClient';
import Link from 'next/link';
import { UniversalAnalyzer } from '@/lib/markets/analyzer';
import { createMarketDataProvider } from '@/lib/markets/providers/composite';
import { AnalysisResult, AnalysisMode, UserPosition } from '@/lib/markets/types';
import { getModeConfig } from '@/lib/markets/modes';
import { createSupabaseLogger } from '@/lib/markets/signalLogger';

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

export default function MarketsDashboardPage() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzingTicker, setAnalyzingTicker] = useState<string | null>(null);
    const [analysisResults, setAnalysisResults] = useState<Map<string, AnalysisResult>>(new Map());
    const [defaultMode, setDefaultMode] = useState<AnalysisMode>('long-term');
    const [newTicker, setNewTicker] = useState('');
    const [addingTicker, setAddingTicker] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    const analyzer = new UniversalAnalyzer(
        createMarketDataProvider(), // Uses real data for ETH if enabled, mock otherwise
        createSupabaseLogger(supabase) // Auto-log all analyses
    );

    // Load user data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            
            // Get user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            // Load watchlist
            const { data: watchlistData, error: watchlistError } = await supabase
                .from('market_watchlist')
                .select('*')
                .eq('user_id', user.id)
                .order('ticker');

            if (watchlistError) {
                console.error('Error loading watchlist:', watchlistError);
            } else {
                setWatchlist(watchlistData || []);
            }

            // Load positions
            const { data: positionsData, error: positionsError } = await supabase
                .from('market_positions')
                .select('*')
                .eq('user_id', user.id)
                .order('ticker');

            if (positionsError) {
                console.error('Error loading positions:', positionsError);
            } else {
                setPositions(positionsData || []);
            }

            // Load user settings for default mode
            const { data: settingsData } = await supabase
                .from('market_user_settings')
                .select('default_mode')
                .eq('user_id', user.id)
                .single();

            if (settingsData?.default_mode) {
                setDefaultMode(settingsData.default_mode as AnalysisMode);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error loading data:', error);
            setNotification('Error loading data. Check console for details.');
            setLoading(false);
        }
    };

    const handleAddTicker = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicker.trim()) return;

        try {
            setAddingTicker(true);
            const ticker = newTicker.trim().toUpperCase();

            // Detect asset type (simplified - would use analyzer in real implementation)
            const assetType = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL'].includes(ticker) ? 'crypto' :
                ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI'].includes(ticker) ? 'etf' : 'stock';

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('market_watchlist')
                .insert({
                    user_id: user.id,
                    ticker,
                    asset_type: assetType,
                });

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    setNotification(`${ticker} is already in your watchlist.`);
                } else {
                    setNotification('Error adding ticker: ' + error.message);
                }
            } else {
                setNewTicker('');
                setNotification(`${ticker} added to watchlist.`);
                await loadData();
            }
        } catch (error) {
            console.error('Error adding ticker:', error);
            setNotification('Error adding ticker. Check console for details.');
        } finally {
            setAddingTicker(false);
        }
    };

    const handleRemoveFromWatchlist = async (ticker: string) => {
        try {
            // Get authenticated user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('market_watchlist')
                .delete()
                .eq('user_id', user.id)
                .eq('ticker', ticker);

            if (error) {
                setNotification('Error removing ticker: ' + error.message);
            } else {
                setNotification(`${ticker} removed from watchlist.`);
                await loadData();
            }
        } catch (error) {
            console.error('Error removing ticker:', error);
            setNotification('Error removing ticker.');
        }
    };

    const analyzeTicker = async (ticker: string, assetType: 'stock' | 'crypto' | 'etf') => {
        if (analyzingTicker) return;

        try {
            setAnalyzingTicker(ticker);
            
            // Find position if exists
            const position = positions.find(p => p.ticker === ticker);
            let userPosition: UserPosition | undefined;
            
            if (position && position.current_price) {
                userPosition = {
                    ticker,
                    averageEntry: position.average_entry,
                    quantity: position.quantity,
                    currentPrice: position.current_price,
                    pnl: (position.current_price - position.average_entry) * position.quantity,
                    pnlPercent: ((position.current_price - position.average_entry) / position.average_entry) * 100,
                };
            }

            const result = await analyzer.analyzeTicker(ticker, defaultMode, userPosition);
            
            setAnalysisResults(prev => new Map(prev).set(ticker, result));
        } catch (error) {
            console.error('Error analyzing ticker:', error);
            setNotification(`Error analyzing ${ticker}. Check console for details.`);
        } finally {
            setAnalyzingTicker(null);
        }
    };

    const getScoreColor = (score: number, isRisk = false) => {
        if (isRisk) {
            if (score > 70) return 'text-red-600 dark:text-red-400';
            if (score > 50) return 'text-yellow-600 dark:text-yellow-400';
            return 'text-green-600 dark:text-green-400';
        }
        if (score > 7) return 'text-green-600 dark:text-green-400';
        if (score > 5) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getRegimeColor = (regime: string) => {
        if (regime === 'bull') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        if (regime === 'bear') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-600 dark:text-slate-400">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Markets Dashboard</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Monitor your watchlist and positions. Analyze any ticker instantly.
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

            {/* Add Ticker Form */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <form onSubmit={handleAddTicker} className="flex gap-2">
                    <input
                        type="text"
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                        placeholder="Enter ticker (e.g., AAPL, BTC, SPY)"
                        className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                    />
                    <button
                        type="submit"
                        disabled={addingTicker || !newTicker.trim()}
                        className="rounded-md bg-amber-500 dark:bg-amber-400 text-black px-4 py-2 text-sm font-medium hover:bg-amber-600 dark:hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {addingTicker ? 'Adding...' : 'Add to Watchlist'}
                    </button>
                </form>
            </div>

            {/* Positions Section */}
            {positions.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Your Positions</h2>
                    <div className="space-y-3">
                        {positions.map(pos => {
                            const analysis = analysisResults.get(pos.ticker);
                            const pnlPercent = pos.current_price
                                ? ((pos.current_price - pos.average_entry) / pos.average_entry) * 100
                                : 0;

                            return (
                                <div
                                    key={pos.id}
                                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/markets/${pos.ticker}`}
                                                    className="text-lg font-semibold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400"
                                                >
                                                    {pos.ticker}
                                                </Link>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                                                    {pos.asset_type}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                                {pos.quantity} @ ${pos.average_entry.toFixed(2)} avg
                                                {pos.current_price && (
                                                    <> • Current: ${pos.current_price.toFixed(2)}</>
                                                )}
                                            </div>
                                            {pos.current_price && (
                                                <div
                                                    className={`mt-1 text-sm font-medium ${
                                                        pnlPercent >= 0
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : 'text-red-600 dark:text-red-400'
                                                    }`}
                                                >
                                                    {pnlPercent >= 0 ? '+' : ''}
                                                    {pnlPercent.toFixed(2)}%
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!analysis && (
                                                <button
                                                    onClick={() => analyzeTicker(pos.ticker, pos.asset_type)}
                                                    disabled={analyzingTicker === pos.ticker}
                                                    className="text-xs px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {analyzingTicker === pos.ticker ? 'Analyzing...' : 'Analyze'}
                                                </button>
                                            )}
                                            <Link
                                                href={`/markets/${pos.ticker}`}
                                                className="text-xs px-3 py-1 rounded-md bg-amber-500 dark:bg-amber-400 text-black hover:bg-amber-600 dark:hover:bg-amber-300 transition-colors"
                                            >
                                                View Details
                                            </Link>
                                        </div>
                                    </div>
                                    {analysis && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-4 text-sm">
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">Buy:</span>
                                                    <span className={`ml-1 font-semibold ${getScoreColor(analysis.buyScore)}`}>
                                                        {analysis.buyScore.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">Sell:</span>
                                                    <span className={`ml-1 font-semibold ${getScoreColor(analysis.sellScore)}`}>
                                                        {analysis.sellScore.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">Risk:</span>
                                                    <span className={`ml-1 font-semibold ${getScoreColor(analysis.riskScore, true)}`}>
                                                        {analysis.riskScore}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-medium ${getRegimeColor(analysis.marketRegime)}`}
                                                >
                                                    {analysis.marketRegime.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Watchlist Section */}
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Watchlist</h2>
                {watchlist.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 dark:text-slate-400">
                        <p>Your watchlist is empty.</p>
                        <p className="text-sm mt-1">Add tickers above to start tracking them.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {watchlist.map(item => {
                            const analysis = analysisResults.get(item.ticker);

                            return (
                                <div
                                    key={item.id}
                                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/markets/${item.ticker}`}
                                                    className="text-lg font-semibold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400"
                                                >
                                                    {item.ticker}
                                                </Link>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                                                    {item.asset_type}
                                                </span>
                                            </div>
                                            {item.notes && (
                                                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                                    {item.notes}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!analysis && (
                                                <button
                                                    onClick={() => analyzeTicker(item.ticker, item.asset_type)}
                                                    disabled={analyzingTicker === item.ticker}
                                                    className="text-xs px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {analyzingTicker === item.ticker ? 'Analyzing...' : 'Analyze'}
                                                </button>
                                            )}
                                            <Link
                                                href={`/markets/${item.ticker}`}
                                                className="text-xs px-3 py-1 rounded-md bg-amber-500 dark:bg-amber-400 text-black hover:bg-amber-600 dark:hover:bg-amber-300 transition-colors"
                                            >
                                                View Details
                                            </Link>
                                            <button
                                                onClick={() => handleRemoveFromWatchlist(item.ticker)}
                                                className="text-xs px-3 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                    {analysis && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-4 text-sm">
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">Buy:</span>
                                                    <span className={`ml-1 font-semibold ${getScoreColor(analysis.buyScore)}`}>
                                                        {analysis.buyScore.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">Sell:</span>
                                                    <span className={`ml-1 font-semibold ${getScoreColor(analysis.sellScore)}`}>
                                                        {analysis.sellScore.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400">Risk:</span>
                                                    <span className={`ml-1 font-semibold ${getScoreColor(analysis.riskScore, true)}`}>
                                                        {analysis.riskScore}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-medium ${getRegimeColor(analysis.marketRegime)}`}
                                                >
                                                    {analysis.marketRegime.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                                {analysis.explanation}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
