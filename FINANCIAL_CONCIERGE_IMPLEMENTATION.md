# Financial Concierge Implementation

## Overview

The Financial Concierge is a comprehensive financial management system that provides:
- **Data Ingestion**: Monthly transaction sync via Plaid + manual statement uploads (PDF/CSV)
- **Auto-Categorization**: Rule-based categorization with merchant mappings, MCC codes, keywords, and recurring detection
- **Auto-Budget Generation**: Intelligent budget creation from 90-day spend history with profile-specific guardrails
- **Personalized Insights**: Spend trends, recurring subscriptions, unusual spend alerts, cashflow forecasts, goal progress, and actionable recommendations

## Architecture

### Database Schema

All tables are defined in `supabase/migrations/019_financial_concierge_tables.sql`:

- **user_survey**: Financial goals, risk tolerance, income stability, debt details
- **user_profile**: Derived profile type (debt_payoff, saving_focused, investing_focused, spend_control, rebuild_credit, mixed)
- **statement_files**: Uploaded statement metadata with secure storage paths
- **statement_periods**: Statement period tracking for reconciliation
- **merchant_mappings**: User overrides for merchant-to-category mappings
- **category_rules**: Rule-based categorization (merchant_match, keyword, mcc_code, amount_range, recurring_pattern)
- **recurring_items**: Detected recurring subscriptions/bills
- **budget_plans**: Monthly budget plans with status (draft, active, archived)
- **budget_items**: Individual category budgets within a plan with guardrail adjustments
- **insights**: Generated insights (spend_trend, recurring_subscription, unusual_spend, cashflow_forecast, goal_progress, category_overage, opportunity)
- **recommendations**: Actionable suggestions tied to user goals
- **financial_audit_log**: Audit trail for all sensitive operations

### Service Layer

Located in `src/lib/financial-concierge/`:

1. **userProfileService.ts**: Derives user profile type from survey responses and generates guardrails
2. **transactionSyncService.ts**: Syncs transactions from Plaid (supports monthly cron job)
3. **statementImportService.ts**: Handles PDF/CSV uploads to secure storage and processes statements
4. **categoryEngine.ts**: Categorization engine with rule-based matching, merchant mappings, and optional ML
5. **budgetEngine.ts**: Generates budgets from 90-day spend history with profile-specific guardrails
6. **insightEngine.ts**: Generates insights and personalized recommendations

### API Routes

- `POST /api/financial-concierge/survey` - Submit/update user survey
- `GET /api/financial-concierge/survey` - Get user survey
- `GET /api/financial-concierge/profile` - Get user profile
- `POST /api/financial-concierge/sync-transactions` - Manual transaction sync
- `POST /api/financial-concierge/upload-statement` - Upload statement file
- `POST /api/financial-concierge/process-statement` - Process uploaded statement
- `POST /api/financial-concierge/generate-budget` - Generate budget plan
- `POST /api/financial-concierge/generate-insights` - Generate insights and recommendations
- `POST /api/financial-concierge/jobs/monthly-refresh` - Monthly cron job (requires CRON_SECRET)
- `POST /api/financial-concierge/jobs/weekly-insights` - Weekly insights cron job (requires CRON_SECRET)

### UI Pages

- `/finance/concierge` - Main dashboard
- `/finance/concierge/survey` - Onboarding survey
- `/finance/concierge/upload` - Statement upload page
- `/finance/concierge/budget` - Budget plan view (to be implemented)
- `/finance/concierge/insights` - Insights and recommendations view (to be implemented)

## Features

### 1. User Survey & Profile

Users complete a survey covering:
- Financial goals (debt payoff, saving, investing, spend control, rebuild credit, buy house/car)
- Risk tolerance (conservative, moderate, aggressive)
- Income stability (stable, variable, unstable)
- Household size
- Target savings amount and timeline
- Debt details (APRs, due dates, minimum payments)
- Debt payoff strategy preference (avalanche, snowball, minimum)

The system derives a **UserProfileType** from survey responses:
- `debt_payoff`: Emphasizes minimum payments, reduces discretionary spending
- `saving_focused`: Emphasizes sinking funds, caps non-essential spending
- `investing_focused`: Maintains essential spending, optimizes for investment
- `spend_control`: Strict category limits, caps increases
- `rebuild_credit`: Prioritizes bills, reduces unnecessary spending
- `mixed`: Balanced approach for multiple goals

### 2. Data Ingestion

#### Transaction Sync (Plaid)
- Monthly scheduled job syncs last 90 days
- Manual "Run now" triggers sync for last 30 days
- Handles account syncing and transaction import
- Skips pending transactions
- Prevents duplicates via `plaid_transaction_id`

#### Statement Import (PDF/CSV)
- Secure file upload to Supabase Storage (private bucket: `statement-files`)
- Metadata stored in database, raw files in private storage
- PDF parsing using existing `pdfParser.ts`
- CSV parsing with flexible column detection
- User consent required before upload
- Audit logging for all uploads

### 3. Categorization Engine

**Priority Order:**
1. User overrides (merchant mappings) - highest confidence (1.0)
2. Rule-based matching (merchant_match, keyword, MCC, amount_range)
3. Optional ML/embedding matcher (toggle-able)

**Features:**
- Merchant name normalization for fuzzy matching
- Keyword matching with AND/OR logic
- MCC code matching for merchant categories
- Amount range rules
- Recurring pattern detection (weekly, biweekly, monthly, quarterly, yearly)
- User overrides automatically create merchant mappings
- Confidence scores stored with each categorization

### 4. Budget Generation

**Process:**
1. Analyzes last 90 days of spending by category
2. Calculates average monthly spend per category
3. Applies profile-specific guardrails:
   - **Debt Payoff**: Reduces discretionary by 20%, emphasizes minimum payments
   - **Saving Focused**: Caps non-essential categories at 5% of income each
   - **Spend Control**: Limits increases to 10% above average
   - **Rebuild Credit**: Reduces non-essential by 10%
   - **Investing Focused**: Similar to saving focused
4. Creates budget plan with items
5. Stores guardrail adjustments and reasons

### 5. Insights & Recommendations

**Insight Types:**
- **Spend Trends**: Detects increasing/decreasing trends (>10% change)
- **Recurring Subscriptions**: Lists all detected recurring items with total monthly cost
- **Unusual Spend Alerts**: Flags transactions >2 standard deviations above mean
- **Cashflow Forecast**: Projects next 3 months based on average income/expenses
- **Category Overages**: Identifies categories over budget
- **Goal Progress**: Tracks progress toward savings/debt goals (to be enhanced)

**Recommendations:**
- Tied to user goals and profile type
- Priority-based ranking
- Actionable items with clear steps
- Status tracking (pending, in_progress, completed, dismissed)

## Security

### Audit Logging
- All statement uploads logged
- All transaction syncs logged
- All categorization overrides logged
- IP address and user agent captured

### Data Protection
- Files stored in private Supabase Storage bucket
- RLS (Row Level Security) enabled on all tables
- User consent required for statement uploads
- Encryption at rest via Supabase (configured at infrastructure level)

### API Security
- Authentication required for all user-facing endpoints
- Cron jobs protected with `CRON_SECRET` environment variable
- RLS policies ensure users can only access their own data

## Setup & Configuration

### 1. Run Database Migrations

```bash
# Apply the financial concierge tables migration
psql -h your-db-host -U your-user -d your-db -f supabase/migrations/019_financial_concierge_tables.sql

# Apply seed categories (optional, creates global categories)
psql -h your-db-host -U your-user -d your-db -f supabase/migrations/020_seed_financial_categories.sql
```

### 2. Create Supabase Storage Bucket

Create a private bucket named `statement-files`:
```sql
-- In Supabase dashboard or via API
INSERT INTO storage.buckets (id, name, public)
VALUES ('statement-files', 'statement-files', false);
```

### 3. Configure Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# For Plaid integration
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox  # or 'production'

# For cron jobs
CRON_SECRET=your-secure-random-string
```

### 4. Set Up Cron Jobs

**Monthly Refresh Job** (runs on 1st of month):
```bash
# Example cron configuration
0 2 1 * * curl -X POST https://your-domain.com/api/financial-concierge/jobs/monthly-refresh \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Weekly Insights Job** (runs every Monday):
```bash
# Example cron configuration
0 3 * * 1 curl -X POST https://your-domain.com/api/financial-concierge/jobs/weekly-insights \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Usage

### User Onboarding Flow

1. User navigates to `/finance/concierge`
2. If no profile exists, user is prompted to take survey
3. User completes survey at `/finance/concierge/survey`
4. System derives profile type and creates user profile
5. User can now use all concierge features

### Transaction Sync

**Manual Sync:**
```typescript
// Frontend code
const response = await fetch('/api/financial-concierge/sync-transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ date_range_days: 30 }),
});
```

**Monthly Automatic Sync:**
- Configured via cron job (see Setup section)
- Runs automatically on 1st of month
- Syncs last 90 days for all users with Plaid items

### Statement Upload

1. User navigates to `/finance/concierge/upload`
2. Selects PDF or CSV file
3. Optionally selects account
4. Provides consent
5. File uploaded to secure storage
6. System processes file and imports transactions
7. Transactions await categorization

### Budget Generation

**Manual Generation:**
```typescript
const response = await fetch('/api/financial-concierge/generate-budget', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ month: '2024-01' }),
});
```

**Automatic Generation:**
- Part of monthly refresh job
- Generates budget for current month
- Uses last 90 days of data

### Insights Generation

**Manual Generation:**
```typescript
const response = await fetch('/api/financial-concierge/generate-insights', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ month: '2024-01' }),
});
```

**Automatic Generation:**
- Part of weekly insights job
- Regenerates insights for current month
- Ensures recommendations stay up-to-date

## Testing

Test files are located in `src/lib/financial-concierge/__tests__/`:
- `categoryEngine.test.ts` - Categorization logic tests
- `budgetEngine.test.ts` - Budget generation and guardrail tests

Run tests:
```bash
npm test
```

## Future Enhancements

1. **ML/Embedding Matcher**: Implement optional embedding-based categorization
2. **Admin Debug View**: UI to view categorization confidence and rule hits
3. **Budget Plan UI**: Full budget plan viewing and editing interface
4. **Insights UI**: Rich visualization of insights and recommendations
5. **Goal Progress Tracking**: Enhanced goal progress with visual indicators
6. **CSV Export**: Allow users to export their financial data
7. **Recurring Item Management**: UI to confirm/edit recurring items
8. **Category Rule Builder**: UI to create custom categorization rules

## Notes

- Long text fields are truncated in UI with expand capability (implement in components)
- Encryption at rest is handled by Supabase infrastructure
- All user data is isolated via RLS policies
- Audit logs are retained for compliance
- Statement files are stored securely and can be deleted by users

