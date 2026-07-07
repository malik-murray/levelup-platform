import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getAuthenticatedUser';
import { UniversalAnalyzer } from '@/lib/markets/analyzer';
import { createServerMarketDataProvider } from '@/lib/markets/providers/server';
import { createSupabaseLogger } from '@/lib/markets/signalLogger';
import { AnalysisMode, UserPosition } from '@/lib/markets/types';

const VALID_MODES: AnalysisMode[] = ['long-term', 'swing', 'risk-only'];

/**
 * GET /api/markets/analyze?ticker=AAPL&mode=long-term&avgEntry=150&quantity=10
 *
 * Runs the UniversalAnalyzer server-side so ALPHA_VANTAGE_API_KEY never
 * reaches the client, and so real-data fetches go through the rate-limited
 * cache in src/lib/markets/dataCache.ts instead of being called directly
 * from the browser.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const tickerParam = searchParams.get('ticker')?.trim().toUpperCase();
        const modeParam = (searchParams.get('mode') || 'long-term') as AnalysisMode;
        const avgEntryParam = searchParams.get('avgEntry');
        const quantityParam = searchParams.get('quantity');

        if (!tickerParam) {
            return NextResponse.json({ error: 'ticker query param is required' }, { status: 400 });
        }
        if (!VALID_MODES.includes(modeParam)) {
            return NextResponse.json({ error: `mode must be one of: ${VALID_MODES.join(', ')}` }, { status: 400 });
        }

        const isEth = tickerParam === 'ETH' || tickerParam === 'ETH-USD';
        const analysisTicker = isEth ? 'ETH-USD' : tickerParam;

        let userPosition: UserPosition | undefined;
        const avgEntry = avgEntryParam ? parseFloat(avgEntryParam) : undefined;
        const quantity = quantityParam ? parseFloat(quantityParam) : undefined;
        if (avgEntry !== undefined && !Number.isNaN(avgEntry) && quantity !== undefined && !Number.isNaN(quantity)) {
            userPosition = {
                ticker: analysisTicker,
                averageEntry: avgEntry,
                quantity,
                currentPrice: avgEntry,
                pnl: 0,
                pnlPercent: 0,
            };
        }

        const analyzer = new UniversalAnalyzer(
            createServerMarketDataProvider(),
            createSupabaseLogger(auth.supabase)
        );

        const result =
            isEth && modeParam === 'swing'
                ? await analyzer.analyzeEthSwing(userPosition)
                : await analyzer.analyzeTicker(analysisTicker, modeParam, userPosition);

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to analyze ticker';
        console.error('[markets/analyze]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
