# App Spec – Markets / Stock & Crypto Analyzer (`/markets`)

## 1. Purpose

Give Malik a focused place to track Ethereum and other assets, see key metrics, and (later) get swing-trade style insights.

---

## 2. Core V1 Features

1. **Watchlist**
   - Add tickers (stocks, ETFs, crypto symbols).
   - Show current price, daily change, basic stats (via external API, mocked for now if needed).

2. **Positions**
   - Manual entry of holdings: symbol, quantity, cost basis.
   - Show P/L and allocation breakdown.

3. **Asset Detail (ETH First)**
   - For a chosen symbol, show:
     - Price chart (simple line).
     - Key metrics.
     - Notes field for Malik’s thoughts.

4. **AI Commentary (Optional V1)**
   - Simple “Summarize this asset’s recent movement” using external data + OpenAI (can be stubbed early).

---

## 3. Data Model

- `watchlist_items`
  - `id`, `user_id`, `symbol`, `notes`

- `positions`
  - `id`, `user_id`, `symbol`, `quantity`, `cost_basis`

- `asset_notes`
  - `id`, `user_id`, `symbol`, `note`, `created_at`

External market data will come from an API; store only what’s needed locally.

---

## 4. Pages

1. `/markets`
   - Watchlist + positions overview.

2. `/markets/[symbol]`
   - Asset detail view, notes, basic charts.

---

## 5. Out of Scope for V1

- Automated trade signals and notifications
- Real trading or brokerage integration
