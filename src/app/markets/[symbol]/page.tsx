'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import { UniversalAnalyzer } from '@/lib/markets/analyzer';
import { createMarketDataProvider } from '@/lib/markets/providers/composite';
import { AnalysisResult, AnalysisMode, UserPosition } from '@/lib/markets/types';
import { getModeConfig, MODE_CONFIGS } from '@/lib/markets/modes';
import { createSupabaseLogger } from '@/lib/markets/signalLogger';
import { getSwingPlaybookTier, getTierColor } from '@/lib/markets/swingPlaybook';
import { createAlertIfNeeded } from '@/lib/markets/alertService';

export default function TickerAnalysisPage() {
    const params = useParams();
    const router = useRouter();
    const ticker = (params.symbol as string)?.toUpperCase();

    // Default to swing mode for ETH, otherwise long-term
    const isEth = ticker === 'ETH' || ticker === 'ETH-USD';
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [mode, setMode] = useState<AnalysisMode>(isEth ? 'swing' : 'long-term');
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [userPosition, setUserPosition] = useState<UserPosition | undefined>(undefined);
    const [notification, setNotification] = useState<string | null>(null);
    
    // Real-time price state (separate from analysis)
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange24h, setPriceChange24h] = useState<number | undefined>(undefined);
    const [priceChangePercent24h, setPriceChangePercent24h] = useState<number | undefined>(undefined);
    const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

    // Create analyzer with composite provider (switches between real/mock based on config)
    // and logger that will automatically log to database
    const analyzer = new UniversalAnalyzer(
        createMarketDataProvider(), // Uses real data for ETH if enabled, mock otherwise
        createSupabaseLogger(supabase) // Logger will fetch userId dynamically
    );

    useEffect(() => {
        if (!ticker) return;
        loadUserPosition();
    }, [ticker]);

    // Reset mode when ticker changes
    useEffect(() => {
        if (!ticker) return;
        const newIsEth = ticker === 'ETH' || ticker === 'ETH-USD';
        setMode(prevMode => {
            if (newIsEth && prevMode !== 'swing') {
                return 'swing';
            } else if (!newIsEth && prevMode === 'swing') {
                return 'long-term';
            }
            return prevMode;
        });
    }, [ticker]);

    useEffect(() => {
        if (!ticker) return;
        runAnalysis();
    }, [ticker, mode]);
    
    // Real-time price refresh (every 15 seconds)
    useEffect(() => {
        if (!ticker) return;
        
        const analysisTicker = isEth ? 'ETH-USD' : ticker;
        const dataProvider = createMarketDataProvider();
        
        // Initial price fetch
        const fetchPrice = async () => {
            try {
                const priceData = await dataProvider.getCurrentPrice(analysisTicker);
                setCurrentPrice(priceData.price);
                setPriceChange24h(priceData.change24h);
                setPriceChangePercent24h(priceData.changePercent24h);
                setLastPriceUpdate(new Date());
                
                // Update analysis with new price if analysis exists
                setAnalysis(prev => prev ? {
                    ...prev,
                    currentPrice: priceData.price,
                } : null);
            } catch (error) {
                console.error('Error fetching current price:', error);
            }
        };
        
        // Fetch immediately
        fetchPrice();
        
        // Set up interval to refresh every 15 seconds
        const interval = setInterval(fetchPrice, 15000);
        
        return () => clearInterval(interval);
    }, [ticker, isEth]);

    const loadUserPosition = async () => {
        try {
            // Get authenticated user
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                router.push('/login');
                return;
            }

            // Check for both ETH and ETH-USD formats
            const searchTicker = isEth ? ['ETH', 'ETH-USD'] : [ticker];

            const { data } = await supabase
                .from('market_positions')
                .select('*')
                .eq('user_id', authUser.id)
                .in('ticker', searchTicker)
                .single();

            if (data) {
                // We'll update with current price when analyzing
                setUserPosition({
                    ticker: data.ticker,
                    averageEntry: data.average_entry,
                    quantity: data.quantity,
                    currentPrice: data.current_price || data.average_entry,
                    pnl: 0,
                    pnlPercent: 0,
                    riskTolerance: data.risk_tolerance as 'low' | 'medium' | 'high' | undefined,
                });
            }
        } catch (error) {
            console.error('Error loading position:', error);
        }
    };

    const runAnalysis = async () => {
        if (!ticker) return;

        try {
            setLoading(true);
            setAnalyzing(true);

            // Use ETH-USD format for analysis
            const analysisTicker = isEth ? 'ETH-USD' : ticker;

            // Update user position with current price if available
            let position = userPosition;
            if (position) {
                const currentPriceData = await analyzer.getCurrentPrice(analysisTicker);
                position = {
                    ...position,
                    currentPrice: currentPriceData.price,
                    pnl: (currentPriceData.price - position.averageEntry) * position.quantity,
                    pnlPercent: ((currentPriceData.price - position.averageEntry) / position.averageEntry) * 100,
                };
                setUserPosition(position);
            }

            // Use convenience function for ETH swing analysis
            let result: AnalysisResult;
            if (isEth && mode === 'swing') {
                result = await analyzer.analyzeEthSwing(position);
            } else {
                result = await analyzer.analyzeTicker(analysisTicker, mode, position);
            }
            
            setAnalysis(result);
            
            // Update current price state from analysis result
            if (result.currentPrice) {
                setCurrentPrice(result.currentPrice);
            }
            
            // Update price change data if available from the price fetch
            try {
                const priceData = await analyzer.getCurrentPrice(analysisTicker);
                setPriceChange24h(priceData.change24h);
                setPriceChangePercent24h(priceData.changePercent24h);
            } catch (error) {
                // Ignore errors - price change is optional
            }
            
            // Check if we should create an alert for this analysis
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                if (authUser) {
                    await createAlertIfNeeded(result, authUser.id);
                }
            } catch (error) {
                // Ignore alert errors - don't break the analysis flow
                console.error('Error creating alert:', error);
            }
            
            // Signal is automatically logged by SignalEngine - no need to log again
        } catch (error) {
            console.error('Error analyzing ticker:', error);
            setNotification('Error analyzing ticker. Check console for details.');
        } finally {
            setLoading(false);
            setAnalyzing(false);
        }
    };


    const getScoreColor = (score: number, isRisk = false) => {
        if (isRisk) {
            if (score > 70) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            if (score > 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        }
        if (score > 7) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        if (score > 5) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    };

    const getScoreBarColor = (score: number, isRisk = false) => {
        if (isRisk) {
            if (score > 70) return 'bg-red-500';
            if (score > 50) return 'bg-yellow-500';
            return 'bg-green-500';
        }
        if (score > 7) return 'bg-green-500';
        if (score > 5) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getRegimeColor = (regime: string) => {
        if (regime === 'bull') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        if (regime === 'bear') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    };

    const formatAction = (action: string) => {
        return action
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Display ticker - show ETH instead of ETH-USD for better UX
    const displayTicker = isEth ? 'ETH' : ticker;
    
    // Calculate playbook result once for Swing mode
    const playbookResult = useMemo(() => {
        if (mode === 'swing' && analysis) {
            return getSwingPlaybookTier(analysis);
        }
        return null;
    }, [mode, analysis]);
    
    const tierColors = playbookResult ? getTierColor(playbookResult.tier) : null;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-slate-600 dark:text-slate-400">Analyzing {displayTicker}...</div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-600 dark:text-slate-400">No analysis available for {displayTicker}.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{displayTicker}</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {analysis.assetType.toUpperCase()} Analysis
                    </p>
                </div>
                <button
                    onClick={() => router.push('/markets')}
                    className="text-sm px-4 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                    ← Back to Dashboard
                </button>
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

            {/* Mode Selector */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Analysis Mode:</span>
                    {Object.values(MODE_CONFIGS).map(modeConfig => (
                        <button
                            key={modeConfig.name}
                            onClick={() => setMode(modeConfig.name)}
                            disabled={analyzing}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                mode === modeConfig.name
                                    ? 'bg-amber-500 dark:bg-amber-400 text-black'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            } disabled:opacity-50`}
                        >
                            {modeConfig.displayName}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {getModeConfig(mode).description}
                </p>
                {analyzing && (
                    <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                        Re-analyzing...
                    </div>
                )}
            </div>

            {/* Swing Mode Playbook Summary */}
            {playbookResult && tierColors && (
                <div className={`rounded-lg border p-4 ${tierColors.border} ${tierColors.bg}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                Playbook Summary
                            </div>
                            <div className={`text-xl font-bold mb-2 ${tierColors.text}`}>
                                {playbookResult.tier}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                {playbookResult.action}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                {playbookResult.reasoning}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Current Price & Regime */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">Current Price</div>
                        {lastPriceUpdate && (
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                                Live • Updated {new Date(lastPriceUpdate).toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        ${(currentPrice || analysis.currentPrice).toFixed(2)}
                    </div>
                    {priceChange24h !== undefined && priceChangePercent24h !== undefined && (
                        <div className={`text-sm mt-1 ${priceChangePercent24h >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {priceChangePercent24h >= 0 ? '+' : ''}
                            {priceChangePercent24h.toFixed(2)}% ({priceChange24h >= 0 ? '+' : ''}${Math.abs(priceChange24h).toFixed(2)})
                            <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">24h</span>
                        </div>
                    )}
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Market Regime</div>
                    <div className="mt-1">
                        <span
                            className={`inline-block px-3 py-1 rounded text-sm font-medium ${getRegimeColor(analysis.marketRegime)}`}
                        >
                            {analysis.marketRegime.toUpperCase()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Buy Score */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Buy Score</div>
                    <div className={`text-3xl font-bold mb-2 ${getScoreColor(analysis.buyScore)}`}>
                        {analysis.buyScore.toFixed(1)}<span className="text-lg">/10</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${getScoreBarColor(analysis.buyScore)}`}
                            style={{ width: `${(analysis.buyScore / 10) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Sell Score */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Sell Score</div>
                    <div className={`text-3xl font-bold mb-2 ${getScoreColor(analysis.sellScore)}`}>
                        {analysis.sellScore.toFixed(1)}<span className="text-lg">/10</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${getScoreBarColor(analysis.sellScore)}`}
                            style={{ width: `${(analysis.sellScore / 10) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Risk Score */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Risk Score</div>
                    <div className={`text-3xl font-bold mb-2 ${getScoreColor(analysis.riskScore, true)}`}>
                        {analysis.riskScore}<span className="text-lg">/100</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full ${getScoreBarColor(analysis.riskScore, true)}`}
                            style={{ width: `${analysis.riskScore}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Explanation & Suggested Action */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Analysis Summary</div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{analysis.explanation}</p>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Suggested Action:</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatAction(analysis.suggestedAction)}
                    </span>
                </div>
            </div>

            {/* Key Factors */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Key Factors</div>
                <ul className="space-y-2">
                    {analysis.keyFactors.map((factor, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                            <span
                                className={`mt-0.5 ${
                                    factor.impact === 'positive'
                                        ? 'text-green-600 dark:text-green-400'
                                        : factor.impact === 'negative'
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                {factor.impact === 'positive' ? '✓' : factor.impact === 'negative' ? '✗' : '•'}
                            </span>
                            <div>
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {factor.factor}:
                                </span>
                                <span className="text-slate-600 dark:text-slate-400 ml-1">
                                    {factor.description}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Layer Breakdown */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Layer Breakdown</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(analysis.layerBreakdown).map(([layer, score]) => (
                        <div key={layer} className="text-sm">
                            <div className="text-slate-500 dark:text-slate-400 capitalize mb-1">
                                {layer.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                            <div className="text-lg font-semibold text-slate-900 dark:text-white">
                                {score.toFixed(1)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* User Position Info */}
            {userPosition && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                    <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                        Your Position
                    </div>
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                        <div>
                            {userPosition.quantity} shares @ ${userPosition.averageEntry.toFixed(2)} avg
                        </div>
                        <div className="mt-1">
                            Current: ${userPosition.currentPrice.toFixed(2)} • P&L:{' '}
                            <span
                                className={`font-semibold ${
                                    userPosition.pnlPercent >= 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                }`}
                            >
                                {userPosition.pnlPercent >= 0 ? '+' : ''}
                                {userPosition.pnlPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
