# Plaid Integration Setup

This guide explains how to set up Plaid integration for the LevelUp Financial app.

## Prerequisites

1. A Plaid account (sign up at https://plaid.com)
2. Plaid API credentials (Client ID and Secret)
3. Environment variables configured

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Plaid Configuration
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox  # Use 'sandbox' for development, 'production' for production
PLAID_WEBHOOK_URL=https://your-domain.com/api/plaid/webhook  # Optional, for webhook events
```

### Getting Plaid Credentials

1. Log in to your Plaid Dashboard (https://dashboard.plaid.com)
2. Navigate to **Team Settings** > **Keys**
3. Copy your **Client ID** and **Secret**
4. For development, use the **Sandbox** environment credentials
5. For production, use the **Production** environment credentials

## Database Migration

Run the Plaid integration migration:

```bash
# If using Supabase CLI
supabase migration up

# Or apply the migration manually
psql -f supabase/migrations/013_plaid_integration.sql
```

## Features

### 1. Connect Bank Accounts
- Users can connect their bank accounts via Plaid Link
- Supports multiple bank accounts per user
- Secure token exchange and storage

### 2. Automatic Transaction Sync
- Automatically syncs accounts and transactions when connecting
- Manual sync available from the Settings page
- Syncs last 30 days of transactions by default
- Prevents duplicate transactions using Plaid transaction IDs

### 3. Account Mapping
- Plaid accounts are automatically mapped to your account types:
  - `depository` (checking/savings) → `checking` or `savings`
  - `credit` → `credit`
  - `investment`/`brokerage` → `investment`
  - Others → `other`

### 4. Transaction Import
- Transactions are imported with:
  - Date, amount, name, and merchant information
  - Linked to the correct account
  - Marked as synced from Plaid
  - Amounts follow your convention (positive = income, negative = expenses)

## Usage

1. Navigate to **Finance** > **Settings** > **Integrations**
2. Click **Connect Bank Account**
3. Follow the Plaid Link flow to connect your bank
4. Accounts and transactions will be automatically synced
5. Use the **Sync** button to manually refresh data

## Security Notes

⚠️ **Important**: In production, you should encrypt the `access_token` stored in the `plaid_items` table. The current implementation stores tokens in plain text for simplicity.

Consider:
- Using Supabase Vault or similar encryption
- Implementing token rotation
- Using environment-specific secrets management

## Testing

For testing in Sandbox mode, use Plaid's test credentials:
- Username: `user_good`
- Password: `pass_good`
- Institution: Any institution in the Sandbox

See [Plaid's Sandbox documentation](https://plaid.com/docs/sandbox/) for more test scenarios.

## Troubleshooting

### "Failed to create Link token"
- Check that `PLAID_CLIENT_ID` and `PLAID_SECRET` are set correctly
- Verify the Plaid environment matches your credentials

### "Failed to exchange public token"
- Ensure the public token hasn't expired (they expire after 30 minutes)
- Check that the Plaid item hasn't been deleted

### Transactions not syncing
- Check the Plaid item's `error_code` and `error_message` fields
- Verify the access token is still valid
- Check Plaid Dashboard for any item errors

## API Routes

- `POST /api/plaid/create-link-token` - Creates a Link token for Plaid Link
- `POST /api/plaid/exchange-public-token` - Exchanges public token for access token
- `POST /api/plaid/sync` - Syncs accounts and transactions from Plaid

All routes require authentication via Bearer token in the Authorization header.



