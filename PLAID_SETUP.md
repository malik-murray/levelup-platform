# Plaid Integration Setup

Automatic transaction sync uses **Plaid webhooks** + **`/transactions/sync`** (cursor per item). Pending transactions are imported for faster spend alerts; posted transactions merge into the same row without duplicate notifications.

## Environment Variables

```env
# Plaid
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox  # sandbox | production
PLAID_WEBHOOK_URL=https://your-domain.com/api/plaid/webhook  # optional if NEXT_PUBLIC_APP_URL is set

# App URL (used for Link webhook registration fallback)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Server (webhooks + cron backup sync)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=long_random_secret

# Push (optional)
EXPO_ACCESS_TOKEN=           # Expo push for mobile tokens in user_push_subscriptions
PUSH_WEBHOOK_URL=            # Custom HTTP hook for push delivery
PLAID_SKIP_WEBHOOK_VERIFY=1  # local dev only — skip JWT verification
```

Never expose `PLAID_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` to the client.

**Vercel:** Set `PLAID_ENV=production` in **Production** (not only Preview/Development). Without it, the app defaults to Plaid Sandbox while using production keys and returns *invalid client_id or secret*. Redeploy after changing env vars.

## Database

Apply migrations (includes `066_plaid_transactions_sync_and_notifications.sql`):

```bash
supabase migration up
```

Key fields:

- `plaid_items.transactions_cursor` — Plaid sync cursor (per item)
- `plaid_items.last_successful_update` — last successful sync timestamp
- `transactions.pending`, `pending_transaction_id`, `original_pending_transaction_id`, `notified_at`, `removed_at`

## Fix: transactions only update on manual Sync

If Vercel shows **no** `[plaid-webhook]` logs, Plaid is not calling your app. Items linked **before** `PLAID_WEBHOOK_URL` was set often have no item-level webhook.

**Fix (no disconnect):** Finance → Settings → Integrations → **Enable automatic sync**  
(or `POST /api/plaid/register-webhooks` with your session token).

Manual **Sync** also re-registers the webhook for that item on each run.

## How sync runs

| Trigger | Route | Behavior |
|---------|-------|----------|
| Plaid webhook | `POST /api/plaid/webhook` | Responds `200` immediately; runs sync in background on `SYNC_UPDATES_AVAILABLE` |
| Manual | `POST /api/plaid/sync` | Same `syncPlaidTransactionsForItem` |
| Cron backup | `GET /api/cron/plaid-sync` | Every 6 hours (Vercel); `Authorization: Bearer {CRON_SECRET}` |

## Pending → posted deduping

1. Posted transaction with `pending_transaction_id` → update the row whose `plaid_transaction_id` equals that pending id.
2. Otherwise fuzzy-match pending rows (account, amount, merchant, date within 5 days).
3. Preserve `notified_at` so a second push is not sent for the same real-world spend.
4. Idempotency key: `transaction_spend_alert:{user_id}:{original_pending_transaction_id || plaid_transaction_id}`

## Push notifications

See **[PUSH_SETUP.md](./PUSH_SETUP.md)** for Web Push (phone banner alerts). Users enable under **Settings → Spend alerts (push)**.

- Spending = negative `amount` in app convention.
- `maybeNotifyUserOfNewTransaction` sets `notified_at` and writes `notification_events`.
- Requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` on the server.

## API Routes

- `POST /api/plaid/create-link-token` — Link token (includes webhook URL)
- `POST /api/plaid/exchange-public-token` — Store item + access token
- `POST /api/plaid/sync` — Manual sync (authenticated user)
- `POST /api/plaid/webhook` — Plaid callbacks (verified JWT)
- `GET /api/cron/plaid-sync` — Backup sync (cron secret)

## Testing

### Webhook sync (sandbox)

1. Deploy with `PLAID_WEBHOOK_URL` and register URL in [Plaid Dashboard](https://dashboard.plaid.com/developers/webhooks).
2. Use Plaid's webhook tester or `/sandbox/item/fire_webhook` for `SYNC_UPDATES_AVAILABLE`.
3. Confirm logs: `[plaid-webhook] received` → `[plaid-sync] completed`.

### Pending notifications

1. Connect sandbox institution; trigger a pending transaction in sandbox.
2. Run sync (webhook or manual).
3. Check `transactions.pending = true`, `notified_at` set, row in `notification_events`.

### Pending → posted (no duplicate)

1. After pending exists, fire sync again when Plaid posts the transaction.
2. Confirm one row: `pending = false`, `plaid_transaction_id` updated, single `notified_at`, no second notification event.

### Manual sync

Finance → Settings → Integrations → **Sync** (uses the same service as webhook/cron).

## Limitations

Alerts fire when **Plaid receives updated transaction data** from the institution — not guaranteed at card-swipe time. Pending data improves speed but still depends on the bank and Plaid.
