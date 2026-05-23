# Spend alert push notifications (Web Push)

Banner notifications on phones use the **Web Push API** + service worker (`/public/sw.js`). When Plaid sync detects new spending, the server sends one push per transaction (idempotent).

## 1. Generate VAPID keys (once)

```bash
npm run generate-vapid-keys
```

Copy the output into env:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:you@yourdomain.com
```

Add the same values in **Vercel → Production** and redeploy.

## 2. Apply migrations

- `066_plaid_transactions_sync_and_notifications.sql`
- `067_push_subscription_json.sql`

## 3. User enables alerts

1. Open **https://ai.levelupsolutions1.com** (or your production URL) on the phone.
2. **iPhone:** Safari → Share → **Add to Home Screen** (required for iOS push).
3. **Settings → Spend alerts (push)** → turn **on** → allow notifications.

Subscriptions are stored in `user_push_subscriptions` (`platform: web`).

## 4. How delivery works

1. Plaid webhook/cron/manual sync inserts or updates a transaction.
2. `maybeNotifyUserOfNewTransaction` runs (spending only, `notified_at` guard).
3. `sendFinanceSpendPush` calls `web-push` for each stored subscription.
4. Service worker shows the system banner.

## 5. Verify

- Supabase: row in `user_push_subscriptions` after enabling toggle.
- Trigger a small new spend or manual sync with a new transaction.
- `notification_events.delivery_status` should be `sent` (not `skipped`).

## Limits

- Alerts fire when **Plaid provides** the transaction, not necessarily at card swipe.
- **iOS** requires the site installed to Home Screen and iOS 16.4+.
- **Android:** Chrome works with the site open or in background after subscribe.

## Optional: native app later

Expo tokens (`EXPO_ACCESS_TOKEN`) are still supported in `sendFinanceSpendPush` for a future React Native app.
