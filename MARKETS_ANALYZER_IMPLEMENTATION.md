# LevelUp Finance - Universal Analyzer (V1) Implementation

## Overview

This document describes the complete implementation of the LevelUp Finance Universal Analyzer (V1), a multi-asset, multi-mode financial analyzer for stocks, crypto, and ETFs.

## Architecture

The system is built with a modular, extensible architecture designed to easily accommodate future V2/V3 features:

### Core Components

1. **Market Data Abstraction Layer** (`src/lib/markets/providers/`)
   - `MarketDataProvider` interface - allows switching between data sources
   - `MockMarketDataProvider` - generates realistic mock data for development
   - `BinanceCryptoProvider` - fetches real ETH data from Binance Public API (free, no auth)
   - `CompositeMarketDataProvider` - routes requests based on ticker and config
   - Easy to swap with real providers (Polygon, Alpha Vantage, etc.)
   - Configurable via `NEXT_PUBLIC_USE_REAL_ETH_DATA` environment variable

2. **Modular Data Layers** (`src/lib/markets/layers/`)
   - Each layer is independent and returns standardized output
   - **Trend Layer** - Detects uptrend/downtrend/sideways using moving averages
   - **Momentum Layer** - RSI and MACD analysis for momentum signals
   - **Support/Resistance Layer** - Identifies key price levels
   - **Volume/Volatility Layer** - Volume patterns and risk metrics
   - **Fundamentals Layer** - PE, PS, revenue growth (stocks/ETFs only)
   - **User Position Layer** - Personalizes analysis based on user's position

3. **Unified Signal Engine** (`src/lib/markets/signalEngine.ts`)
   - Combines all layer outputs with mode-specific weightings
   - Produces Buy/Sell/Risk scores (0-10, 0-100)
   - Generates plain-English explanations
   - Determines market regime (Bull/Bear/Range)
   - Suggests actions based on scores

4. **Mode System** (`src/lib/markets/modes.ts`)
   - **Long-Term Investor** - Emphasizes fundamentals, higher timeframes
   - **Swing Trader** - Focus on trends, momentum, support/resistance
   - **Risk-Only/Beginner** - Heavy focus on volatility and risk metrics
   - Modes only adjust weights/thresholds, not architecture

5. **Universal Analyzer** (`src/lib/markets/analyzer.ts`)
   - Main service that orchestrates data fetching and analysis
   - Handles ticker analysis and batch analysis
   - Integrates all components seamlessly

## Database Schema

Created migration: `supabase/migrations/011_markets_tables.sql`

### Tables

1. **market_positions** - User's tracked positions
   - Stores ticker, quantity, average entry, current price
   - Supports fractional shares/crypto

2. **market_watchlist** - Tickers user wants to monitor
   - Simple ticker tracking with optional notes

3. **market_signal_logs** - Analysis history for backtesting/ML
   - Stores all analysis results with full layer breakdowns
   - Enables future backtesting and accuracy improvement

4. **market_user_settings** - User preferences
   - Default mode, risk tolerance, notifications

All tables include Row Level Security (RLS) policies for user data isolation.

## User Interface

### Pages

1. **Dashboard/Watchlist** (`src/app/markets/page.tsx`)
   - Add/manage watchlist items
   - View positions
   - Quick analysis preview
   - Links to detailed analysis

2. **Ticker Analysis** (`src/app/markets/[symbol]/page.tsx`)
   - Detailed analysis for any ticker
   - Mode selection with live re-analysis
   - Visual score displays (Buy/Sell/Risk)
   - Market regime indicator
   - Explanation and suggested action
   - Key factors breakdown
   - Layer breakdown visualization
   - User position context (if applicable)

3. **Portfolio Overview** (`src/app/markets/portfolio/page.tsx`)
   - Aggregate portfolio metrics
   - Total value, cost, P&L
   - Position-by-position breakdown
   - Quick analysis for each position
   - Portfolio-level insights

4. **Settings** (`src/app/markets/settings/page.tsx`)
   - Set default analysis mode
   - Configure risk tolerance
   - Enable/disable notifications
   - User preferences management

### Layout

- Consistent layout with navigation tabs (`src/app/markets/layout.tsx`)
- Dark mode support
- Responsive design
- Clean, beginner-friendly UI

## Features Implemented

### ✅ Core Requirements

- [x] Multi-asset support (Stocks, Crypto, ETFs)
- [x] Three analysis modes (Long-Term, Swing, Risk-Only)
- [x] Six data layers (all modular and independent)
- [x] Unified signal engine with mode-specific weightings
- [x] Buy/Sell/Risk scores (0-10, 0-100)
- [x] Market regime detection (Bull/Bear/Range)
- [x] Plain-English explanations
- [x] Suggested actions
- [x] Key factors summary
- [x] Layer breakdown
- [x] Signal logging for future backtesting

### ✅ UI Features

- [x] Dashboard with watchlist
- [x] Ticker analysis page with mode selection
- [x] Portfolio overview
- [x] Settings page
- [x] Quick analysis previews
- [x] User position tracking

### ✅ Architecture Requirements

- [x] Modular data-layer system
- [x] Market data abstraction layer
- [x] Multi-timeframe support
- [x] Signal logging system
- [x] Extensible for V2/V3 additions

## File Structure

```
src/lib/markets/
├── types.ts                    # Core types and interfaces
├── analyzer.ts                 # Main analyzer service
├── signalEngine.ts            # Unified signal engine
├── modes.ts                   # Mode configurations
├── providers/
│   ├── base.ts               # Base provider class
│   └── mock.ts               # Mock data provider
└── layers/
    ├── base.ts               # Base layer class
    ├── trend.ts              # Price & trend analysis
    ├── momentum.ts           # RSI/MACD momentum
    ├── supportResistance.ts  # Support/resistance levels
    ├── volumeVolatility.ts   # Volume & volatility metrics
    ├── fundamentals.ts       # Fundamental analysis
    ├── userPosition.ts       # User position analysis
    └── index.ts              # Layer exports

src/app/markets/
├── layout.tsx                # Markets layout with tabs
├── page.tsx                  # Dashboard/Watchlist
├── [symbol]/
│   └── page.tsx             # Ticker analysis page
├── portfolio/
│   └── page.tsx             # Portfolio overview
└── settings/
    └── page.tsx             # User settings

supabase/migrations/
└── 011_markets_tables.sql   # Database schema
```

## Usage Examples

### Analyzing a Ticker

```typescript
import { UniversalAnalyzer } from '@/lib/markets/analyzer';
import { MockMarketDataProvider } from '@/lib/markets/providers/mock';

const analyzer = new UniversalAnalyzer(new MockMarketDataProvider());
const result = await analyzer.analyzeTicker('AAPL', 'long-term');

console.log(result.buyScore);      // 0-10
console.log(result.sellScore);     // 0-10
console.log(result.riskScore);     // 0-100
console.log(result.explanation);   // Plain English explanation
console.log(result.marketRegime);  // 'bull' | 'bear' | 'range'
```

### Adding a Custom Data Provider

Simply implement the `MarketDataProvider` interface:

```typescript
class RealDataProvider implements MarketDataProvider {
    async getCurrentPrice(ticker: string) { ... }
    async getCandles(ticker: string, timeframe: string) { ... }
    async detectAssetType(ticker: string) { ... }
    async getFundamentals(ticker: string) { ... }
}
```

### Adding a New Data Layer

Extend `BaseDataLayer` and add to signal engine:

```typescript
class SentimentLayer extends BaseDataLayer {
    name = 'sentiment';
    async analyze(input: LayerInput): Promise<LayerOutput> {
        // Your analysis logic
        return { score: 5, flags: [], notes: '...' };
    }
    isApplicable(mode: AnalysisMode): boolean { return true; }
}
```

## Future Enhancements (V2/V3)

The architecture is designed to easily accommodate:

- **V2 Features:**
  - Sentiment analysis layer
  - Options flow analysis
  - On-chain data (crypto)
  - Real market data providers
  - Backtesting engine
  - Advanced charting

- **V3 Features:**
  - Machine learning predictions
  - Personalized learning from user trades
  - Auto-optimization of weightings
  - Portfolio AI mode
  - Tax modeling

## Real Market Data Configuration

### Using Real ETH Data

The analyzer supports real ETH market data from Binance Public API (free, no authentication required).

**To enable real ETH data:**

1. Create or update `.env.local` file:
   ```bash
   NEXT_PUBLIC_USE_REAL_ETH_DATA=true
   ```

2. Restart the development server:
   ```bash
   npm run dev
   ```

When enabled:
- ETH/ETH-USD ticker uses real Binance API data
- All other tickers continue using mock data
- Falls back to mock data if API fails (graceful degradation)

**Providers:**
- `BinanceCryptoProvider` - Fetches real ETH candles from Binance
- `CompositeMarketDataProvider` - Routes requests based on ticker and config
- `MockMarketDataProvider` - Used for all non-ETH tickers and as fallback

## Next Steps

1. **Connect More Real Data Providers:**
   - Add Polygon.io for stocks/ETFs
   - Add more crypto pairs to Binance provider
   - Consider Alpha Vantage for stock fundamentals

2. **Enhance UI:**
   - Add charts with price markers
   - Implement position management (add/edit/delete)
   - Add watchlist filtering and sorting

3. **Testing:**
   - Add unit tests for data layers
   - Integration tests for signal engine
   - E2E tests for UI flows

4. **Performance:**
   - Add caching for market data
   - Optimize database queries
   - Implement pagination for large watchlists

## Notes

- Mock data is used by default for all tickers
- Real ETH data available via `NEXT_PUBLIC_USE_REAL_ETH_DATA=true` env var
- Real data provider automatically falls back to mock on API errors
- All analysis is done client-side (can be moved to API routes if needed)
- Signal logging is automatic and non-blocking
- Dark mode support throughout
- Responsive design for mobile/desktop

## Dependencies

No new dependencies were added. The implementation uses existing project dependencies:
- Next.js (React)
- TypeScript
- Supabase (database)
- Tailwind CSS (styling)

