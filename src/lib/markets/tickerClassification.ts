/**
 * Shared ticker classification
 * Single source of truth for which tickers are crypto/ETF vs stock, used by
 * the mock provider, real data providers, and the "add to watchlist" flow.
 */

import { AssetType } from './types';

// Major coins traded against USDT on Binance -- see providers/binance.ts
// toBinanceSymbol(), which appends "USDT" to these.
export const KNOWN_CRYPTO_TICKERS = [
    'BTC', 'ETH', 'ETH-USD', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX',
    'DOT', 'MATIC', 'LINK', 'LTC', 'UNI', 'ATOM',
];

export const KNOWN_ETF_TICKERS = [
    'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO',
];

export function classifyTicker(ticker: string): AssetType {
    const upper = ticker.toUpperCase();

    if (KNOWN_CRYPTO_TICKERS.includes(upper)) {
        return 'crypto';
    }

    if (KNOWN_ETF_TICKERS.includes(upper)) {
        return 'etf';
    }

    return 'stock';
}
