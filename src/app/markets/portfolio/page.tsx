'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@auth/supabaseClient';
import Link from 'next/link';
import { UniversalAnalyzer } from '@/lib/markets/analyzer';
import { createMarketDataProvider } from '@/lib/markets/providers/composite';
import { AnalysisResult, AnalysisMode } from '@/lib/markets/types';
import { createSupabaseLogger } from '@/lib/markets/signalLogger';

type Position = {
    id: string;
    ticker: string;
    asset_type: 'stock' | 'crypto' | 'etf';
    quantity: number;
    average_entry: number;
    current_price: number | null;
    notes: string | null;
};

type PositionWithPriceData = Position & {
    priceChange24h?: number;
    priceChangePercent24h?: number;
};

export default function PortfolioPage() {
    const [positions, setPositions] = useState<PositionWithPriceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<string | null>(null);
    const [analysisResults, setAnalysisResults] = useState<Map<string, AnalysisResult>>(new Map());
    const [analyzingTicker, setAnalyzingTicker] = useState<string | null>(null);
    const [defaultMode, setDefaultMode] = useState<AnalysisMode>('long-term');
    
    // Add position form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTicker, setNewTicker] = useState('');
    const [newQuantity, setNewQuantity] = useState('');
    const [newAvgEntry, setNewAvgEntry] = useState('');
    const [newAssetType, setNewAssetType] = useState<'stock' | 'crypto' | 'etf'>('stock');
    const [newNotes, setNewNotes] = useState('');
    const [addingPosition, setAddingPosition] = useState(false);

    const analyzer = new UniversalAnalyzer(
        createMarketDataProvider(), // Uses real data for ETH if enabled, mock otherwise
        createSupabaseLogger(supabase) // Auto-log all analyses
    );

    useEffect(() => {
        loadData();
    }, []);
    
    const refreshAllPrices = async () => {
        if (positions.length === 0) return;
        
        try {
            const updatedPositions = await Promise.all(
                positions.map(async (pos) => {
                    try {
                        const priceData = await analyzer.getCurrentPrice(pos.ticker);
                        // Update in database
                        await supabase
                            .from('market_positions')
                            .update({ current_price: priceData.price })
                            .eq('id', pos.id);
                        
                        return {
                            ...pos,
                            current_price: priceData.price,
                            priceChange24h: priceData.change24h,
                            priceChangePercent24h: priceData.changePercent24h,
                        };
                    } catch (error) {
                        console.error(`Error refreshing price for ${pos.ticker}:`, error);
                        return pos; // Return unchanged if error
                    }
                })
            );
            
            setPositions(updatedPositions);
        } catch (error) {
            console.error('Error refreshing prices:', error);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/login';
                return;
            }

            // Load positions
            const { data: positionsData, error: positionsError } = await supabase
                .from('market_positions')
                .select('*')
                .order('ticker');

            if (positionsError) {
                console.error('Error loading positions:', positionsError);
                setNotification('Error loading positions. Check console for details.');
            } else {
                const loadedPositions = positionsData || [];
                setPositions(loadedPositions);
                
                // Refresh prices for all positions after loading
                if (loadedPositions.length > 0) {
                    // Refresh prices in background
                    Promise.all(
                        loadedPositions.map(async (pos) => {
                            try {
                                const priceData = await analyzer.getCurrentPrice(pos.ticker);
                                // Update in database
                                await supabase
                                    .from('market_positions')
                                    .update({ current_price: priceData.price })
                                    .eq('id', pos.id);
                                
                                return {
                                    ...pos,
                                    current_price: priceData.price,
                                    priceChange24h: priceData.change24h,
                                    priceChangePercent24h: priceData.changePercent24h,
                                };
                            } catch (error) {
                                console.error(`Error refreshing price for ${pos.ticker}:`, error);
                                return pos;
                            }
                        })
                    ).then(updatedPositions => {
                        setPositions(updatedPositions);
                    });
                }
            }

            // Load default mode
            const { data: settingsData } = await supabase
                .from('market_user_settings')
                .select('default_mode')
                .single();

            if (settingsData?.default_mode) {
                setDefaultMode(settingsData.default_mode as AnalysisMode);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setNotification('Error loading data. Check console for details.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPosition = async (e: FormEvent) => {
        e.preventDefault();
        
        // Validate inputs first
        if (!newTicker.trim()) {
            setNotification('Ticker is required.');
            return;
        }
        
        const quantity = parseFloat(newQuantity);
        const avgEntry = parseFloat(newAvgEntry);
        
        if (isNaN(quantity) || quantity <= 0) {
            setNotification('Quantity must be a positive number.');
            return;
        }
        
        if (isNaN(avgEntry) || avgEntry <= 0) {
            setNotification('Average entry price must be a positive number.');
            return;
        }
        
        try {
            setAddingPosition(true);
            setNotification(null);
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setNotification('You must be logged in to add positions.');
                return;
            }
            
            // Try to get current price for the ticker
            let currentPrice: number | null = null;
            let priceChange24h: number | undefined;
            let priceChangePercent24h: number | undefined;
            
            try {
                const priceData = await analyzer.getCurrentPrice(newTicker.trim().toUpperCase());
                currentPrice = priceData.price;
                priceChange24h = priceData.change24h;
                priceChangePercent24h = priceData.changePercent24h;
            } catch (error) {
                console.warn('Could not fetch current price, will set to null:', error);
            }
            
            const { data, error } = await supabase
                .from('market_positions')
                .insert({
                    user_id: user.id,
                    ticker: newTicker.trim().toUpperCase(),
                    asset_type: newAssetType,
                    quantity,
                    average_entry: avgEntry,
                    current_price: currentPrice,
                    notes: newNotes.trim() || null,
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error adding position:', error);
                
                // Handle specific error cases
                if (error.code === '23505') {
                    setNotification(`Position for ${newTicker.toUpperCase()} already exists.`);
                } else if (error.code === '42501') {
                    setNotification('Permission denied. Please check your account permissions.');
                } else if (error.code === '23503') {
                    setNotification('Invalid data. Please check that all fields are correct.');
                } else {
                    // Try to get a useful error message
                    const errorMessage = error.message || error.details || error.hint || JSON.stringify(error);
                    setNotification(`Error adding position: ${errorMessage}`);
                }
                return;
            }
            
            if (!data) {
                setNotification('Error: Position was not created. Please try again.');
                return;
            }
            
            // Add price change data to the new position
            const newPosition: PositionWithPriceData = {
                ...data,
                priceChange24h,
                priceChangePercent24h,
            };
            
            setPositions(prev => [...prev, newPosition].sort((a, b) => a.ticker.localeCompare(b.ticker)));
            
            // Reset form
            setNewTicker('');
            setNewQuantity('');
            setNewAvgEntry('');
            setNewNotes('');
            setShowAddForm(false);
            setNotification('Position added successfully!');
        } catch (error) {
            console.error('Error adding position:', error);
            setNotification('Error adding position. Check console for details.');
        } finally {
            setAddingPosition(false);
        }
    };
    
    const handleDeletePosition = async (positionId: string, ticker: string) => {
        if (!confirm(`Are you sure you want to delete your ${ticker} position?`)) {
            return;
        }
        
        try {
            const { error } = await supabase
                .from('market_positions')
                .delete()
                .eq('id', positionId);
            
            if (error) {
                console.error('Error deleting position:', error);
                setNotification('Error deleting position: ' + error.message);
                return;
            }
            
            setPositions(prev => prev.filter(p => p.id !== positionId));
            setNotification(`${ticker} position deleted.`);
        } catch (error) {
            console.error('Error deleting position:', error);
            setNotification('Error deleting position.');
        }
    };
    
    const analyzePosition = async (position: Position) => {
        if (analyzingTicker) return;

        try {
            setAnalyzingTicker(position.ticker);

            // Update current price with 24h change data
            const currentPriceData = await analyzer.getCurrentPrice(position.ticker);
            
            // Update position in state with price change data
            setPositions(prev => prev.map(p => 
                p.id === position.id 
                    ? { ...p, current_price: currentPriceData.price, priceChange24h: currentPriceData.change24h, priceChangePercent24h: currentPriceData.changePercent24h }
                    : p
            ));
            
            const userPosition = {
                ticker: position.ticker,
                averageEntry: position.average_entry,
                quantity: position.quantity,
                currentPrice: currentPriceData.price,
                pnl: (currentPriceData.price - position.average_entry) * position.quantity,
                pnlPercent: ((currentPriceData.price - position.average_entry) / position.average_entry) * 100,
            };

            const result = await analyzer.analyzeTicker(position.ticker, defaultMode, userPosition);
            setAnalysisResults(prev => new Map(prev).set(position.ticker, result));

            // Update position current price in database
            await supabase
                .from('market_positions')
                .update({ current_price: currentPriceData.price })
                .eq('id', position.id);
        } catch (error) {
            console.error('Error analyzing position:', error);
            setNotification(`Error analyzing ${position.ticker}. Check console for details.`);
        } finally {
            setAnalyzingTicker(null);
        }
    };

    // Calculate portfolio metrics with enhanced data
    const portfolioMetrics = positions.reduce(
        (acc, pos) => {
            if (!pos.current_price) return acc;

            const value = pos.quantity * pos.current_price;
            const cost = pos.quantity * pos.average_entry;
            const pnl = value - cost;
            
            // Today's return: use 24h change if available
            // If price changed X%, then value changed by X% * current value
            const todayReturn = pos.priceChangePercent24h 
                ? (pos.priceChangePercent24h / 100) * value 
                : 0;

            acc.totalValue += value;
            acc.totalCost += cost;
            acc.totalPnl += pnl;
            acc.totalTodayReturn += todayReturn;

            // Count uptrend/downtrend
            const analysis = analysisResults.get(pos.ticker);
            if (analysis) {
                if (analysis.marketRegime === 'bull') acc.uptrendCount++;
                if (analysis.marketRegime === 'bear') acc.downtrendCount++;
            }

            return acc;
        },
        { totalValue: 0, totalCost: 0, totalPnl: 0, totalTodayReturn: 0, uptrendCount: 0, downtrendCount: 0 }
    );

    const portfolioPnlPercent =
        portfolioMetrics.totalCost > 0
            ? (portfolioMetrics.totalPnl / portfolioMetrics.totalCost) * 100
            : 0;
    
    // Calculate today's return as percentage (weighted average of all positions)
    const portfolioTodayReturnPercent = portfolioMetrics.totalValue > 0
        ? (portfolioMetrics.totalTodayReturn / portfolioMetrics.totalValue) * 100
        : 0;
    
    // Calculate portfolio diversity (allocation % per position)
    const positionsWithDiversity = positions.map(pos => {
        if (!pos.current_price || portfolioMetrics.totalValue === 0) {
            return { ...pos, diversityPercent: 0 };
        }
        const value = pos.quantity * pos.current_price;
        const diversityPercent = (value / portfolioMetrics.totalValue) * 100;
        return { ...pos, diversityPercent };
    });

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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-600 dark:text-slate-400">Loading portfolio...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Portfolio Overview</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Track your positions and overall portfolio performance.
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

            {/* Add Position Form */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Position</h2>
                    <button
                        onClick={() => {
                            setShowAddForm(!showAddForm);
                            if (showAddForm) {
                                setNewTicker('');
                                setNewQuantity('');
                                setNewAvgEntry('');
                                setNewNotes('');
                            }
                        }}
                        className="text-sm px-3 py-1 rounded-md bg-amber-500 dark:bg-amber-400 text-black hover:bg-amber-600 dark:hover:bg-amber-300 transition-colors"
                    >
                        {showAddForm ? 'Cancel' : '+ Add Position'}
                    </button>
                </div>
                
                {showAddForm && (
                    <form onSubmit={handleAddPosition} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Ticker *
                                </label>
                                <input
                                    type="text"
                                    value={newTicker}
                                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                                    placeholder="AAPL, ETH, SPY"
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Asset Type *
                                </label>
                                <select
                                    value={newAssetType}
                                    onChange={(e) => setNewAssetType(e.target.value as 'stock' | 'crypto' | 'etf')}
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                                    required
                                >
                                    <option value="stock">Stock</option>
                                    <option value="crypto">Crypto</option>
                                    <option value="etf">ETF</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Quantity *
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={newQuantity}
                                    onChange={(e) => setNewQuantity(e.target.value)}
                                    placeholder="10.5"
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Avg Entry Price *
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={newAvgEntry}
                                    onChange={(e) => setNewAvgEntry(e.target.value)}
                                    placeholder="150.25"
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                                    required
                                />
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Notes (optional)
                                </label>
                                <input
                                    type="text"
                                    value={newNotes}
                                    onChange={(e) => setNewNotes(e.target.value)}
                                    placeholder="Optional notes about this position"
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
                                />
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={addingPosition}
                                className="px-4 py-2 rounded-md bg-amber-500 dark:bg-amber-400 text-black font-medium hover:bg-amber-600 dark:hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {addingPosition ? 'Adding...' : 'Add Position'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Portfolio Summary */}
            {positions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total Value</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                            ${portfolioMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total Cost</div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                            ${portfolioMetrics.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Overall Return</div>
                        <div
                            className={`text-xl font-bold mt-1 ${
                                portfolioMetrics.totalPnl >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                            }`}
                        >
                            {portfolioMetrics.totalPnl >= 0 ? '+' : ''}
                            ${portfolioMetrics.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div
                            className={`text-xs mt-1 ${
                                portfolioPnlPercent >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                            }`}
                        >
                            {portfolioPnlPercent >= 0 ? '+' : ''}
                            {portfolioPnlPercent.toFixed(2)}%
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Today's Return</div>
                        <div
                            className={`text-xl font-bold mt-1 ${
                                portfolioMetrics.totalTodayReturn >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                            }`}
                        >
                            {portfolioMetrics.totalTodayReturn >= 0 ? '+' : ''}
                            ${portfolioMetrics.totalTodayReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div
                            className={`text-xs mt-1 ${
                                portfolioTodayReturnPercent >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                            }`}
                        >
                            {portfolioTodayReturnPercent >= 0 ? '+' : ''}
                            {portfolioTodayReturnPercent.toFixed(2)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Positions List */}
            {positions.length === 0 ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 dark:text-slate-400">
                    <p>You don't have any positions yet.</p>
                    <p className="text-sm mt-1">Click "Add Position" above to get started.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {positionsWithDiversity.map(pos => {
                        const analysis = analysisResults.get(pos.ticker);
                        const overallReturnPercent = pos.current_price
                            ? ((pos.current_price - pos.average_entry) / pos.average_entry) * 100
                            : null;
                        const positionValue = pos.current_price ? pos.quantity * pos.current_price : null;
                        const avgCost = pos.quantity * pos.average_entry;
                        const todayReturn = pos.priceChangePercent24h && positionValue
                            ? (pos.priceChangePercent24h / 100) * positionValue
                            : null;
                        const todayReturnPercent = pos.priceChangePercent24h || null;

                        return (
                            <div
                                key={pos.id}
                                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-3">
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
                                        
                                        {/* Enhanced Metrics Grid */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Quantity</div>
                                                <div className="font-medium text-slate-900 dark:text-white mt-0.5">
                                                    {pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Value</div>
                                                <div className="font-medium text-slate-900 dark:text-white mt-0.5">
                                                    {positionValue 
                                                        ? `$${positionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                        : 'N/A'}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Avg Cost</div>
                                                <div className="font-medium text-slate-900 dark:text-white mt-0.5">
                                                    ${avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Diversity</div>
                                                <div className="font-medium text-slate-900 dark:text-white mt-0.5">
                                                    {pos.diversityPercent.toFixed(1)}%
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Today's Return</div>
                                                <div
                                                    className={`font-medium mt-0.5 ${
                                                        todayReturnPercent !== null
                                                            ? todayReturnPercent >= 0
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                            : 'text-slate-600 dark:text-slate-400'
                                                    }`}
                                                >
                                                    {todayReturn !== null && todayReturnPercent !== null ? (
                                                        <>
                                                            {todayReturn >= 0 ? '+' : ''}
                                                            ${todayReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            <span className="ml-1 text-xs">
                                                                ({todayReturnPercent >= 0 ? '+' : ''}{todayReturnPercent.toFixed(2)}%)
                                                            </span>
                                                        </>
                                                    ) : (
                                                        'N/A'
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Overall Return</div>
                                                <div
                                                    className={`font-medium mt-0.5 ${
                                                        overallReturnPercent !== null
                                                            ? overallReturnPercent >= 0
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : 'text-red-600 dark:text-red-400'
                                                            : 'text-slate-600 dark:text-slate-400'
                                                    }`}
                                                >
                                                    {overallReturnPercent !== null ? (
                                                        <>
                                                            {overallReturnPercent >= 0 ? '+' : ''}
                                                            {overallReturnPercent.toFixed(2)}%
                                                        </>
                                                    ) : (
                                                        'N/A'
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Additional Info */}
                                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Entry: ${pos.average_entry.toFixed(2)} • {pos.current_price ? `Current: $${pos.current_price.toFixed(2)}` : 'Price: N/A'}
                                        </div>
                                        
                                        {pos.notes && (
                                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">
                                                {pos.notes}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {!analysis && (
                                            <button
                                                onClick={() => analyzePosition(pos)}
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
                                            Details
                                        </Link>
                                        <button
                                            onClick={() => handleDeletePosition(pos.id, pos.ticker)}
                                            className="text-xs px-3 py-1 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                {analysis && (
                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4 text-sm mb-2">
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
                                                className={`px-2 py-1 rounded text-xs font-medium ${
                                                    analysis.marketRegime === 'bull'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                        : analysis.marketRegime === 'bear'
                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                }`}
                                            >
                                                {analysis.marketRegime.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">
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
    );
}

