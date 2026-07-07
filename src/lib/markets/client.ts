'use client';

/**
 * Thin client-side wrapper around /api/markets/* -- keeps real data fetching
 * (and the Alpha Vantage API key) server-side. Session cookies are sent
 * automatically since these are same-origin requests.
 */

import { AnalysisMode, AnalysisResult } from './types';

export type QuoteResponse = {
    price: number;
    change24h?: number;
    changePercent24h?: number;
    stale: boolean;
    source: 'alpha_vantage' | 'binance' | 'mock';
    lastUpdated: string;
};

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body.error || `Request failed (${res.status})`);
    }
    return body as T;
}

export async function fetchAnalysis(
    ticker: string,
    mode: AnalysisMode,
    position?: { averageEntry: number; quantity: number }
): Promise<AnalysisResult> {
    const params = new URLSearchParams({ ticker, mode });
    if (position) {
        params.set('avgEntry', String(position.averageEntry));
        params.set('quantity', String(position.quantity));
    }

    const res = await fetch(`/api/markets/analyze?${params.toString()}`);
    return parseJsonOrThrow<AnalysisResult>(res);
}

export async function fetchQuote(ticker: string): Promise<QuoteResponse> {
    const res = await fetch(`/api/markets/quote?ticker=${encodeURIComponent(ticker)}`);
    return parseJsonOrThrow<QuoteResponse>(res);
}
