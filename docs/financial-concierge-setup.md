# Financial Concierge Setup Guide

## Step 1: Database Migrations ✅

Already completed. The following migrations have been applied:
- `019_financial_concierge_tables.sql` - All Financial Concierge tables
- `020_seed_financial_categories.sql` - Default category seed data (optional)

## Step 2: Create Storage Bucket

### Option A: Via Supabase Dashboard (Recommended)

1. Log in to your Supabase dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"** button
4. Configure the bucket:
   - **Name**: `statement-files`
   - **Public**: ❌ **No** (private bucket)
   - **File size limit**: `10485760` (10MB) or adjust as needed
   - **Allowed MIME types**: `application/pdf, text/csv`
5. Click **"Create bucket"**

### Option B: Via Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Create the bucket (requires manual creation via dashboard or API)
# Storage buckets cannot be created via SQL migrations
```

### Option C: Via Management API

```bash
curl -X POST 'https://<project-ref>.supabase.co/storage/v1/bucket' \
  -H "Authorization: Bearer <service-role-key>" \
  -H "apikey: <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "statement-files",
    "public": false,
    "file_size_limit": 10485760,
    "allowed_mime_types": ["application/pdf", "text/csv"]
  }'
```

### Apply Storage Policies

After creating the bucket, run the storage policies migration:

```sql
-- Run the contents of supabase/migrations/021_create_statement_files_bucket.sql
-- This sets up RLS policies for the storage bucket
```

Or apply via Supabase dashboard:
1. Go to **Storage** → **Policies** → **statement-files**
2. Add the policies from the migration file

## Step 3: Configure Cron Jobs

### Monthly Refresh Job

Runs on the 1st of each month at 2 AM UTC to:
- Sync transactions from Plaid (last 90 days)
- Generate budgets for current month
- Generate insights for current month

#### Option A: Vercel Cron Jobs (if deployed on Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/financial-concierge/jobs/monthly-refresh",
      "schedule": "0 2 1 * *"
    },
    {
      "path": "/api/financial-concierge/jobs/weekly-insights",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

#### Option B: External Cron Service (cron-job.org, EasyCron, etc.)

1. Sign up for a cron service
2. Create a new cron job with:
   - **URL**: `https://your-domain.com/api/financial-concierge/jobs/monthly-refresh`
   - **Schedule**: `0 2 1 * *` (2 AM UTC on 1st of month)
   - **Method**: POST
   - **Headers**: 
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```
3. Repeat for weekly insights job:
   - **URL**: `https://your-domain.com/api/financial-concierge/jobs/weekly-insights`
   - **Schedule**: `0 3 * * 1` (3 AM UTC every Monday)

#### Option C: Server Cron (if self-hosted)

Add to your server's crontab:

```bash
# Edit crontab
crontab -e

# Add these lines:
0 2 1 * * curl -X POST https://your-domain.com/api/financial-concierge/jobs/monthly-refresh -H "Authorization: Bearer YOUR_CRON_SECRET"
0 3 * * 1 curl -X POST https://your-domain.com/api/financial-concierge/jobs/weekly-insights -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Weekly Insights Job

Runs every Monday at 3 AM UTC to:
- Regenerate insights for current month
- Update recommendations based on latest data

### Environment Variables

Add to your `.env.local` or production environment:

```env
# Cron job authentication
CRON_SECRET=your-secure-random-string-here

# Plaid configuration (if not already set)
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox  # or 'production'
```

**Important**: Generate a strong random string for `CRON_SECRET`:
```bash
# Generate a secure random string
openssl rand -hex 32
```

## Step 4: Verify Setup

### Test Storage Bucket

1. Navigate to `/finance/concierge/upload`
2. Try uploading a test PDF or CSV file
3. Check Supabase Storage dashboard to verify file was uploaded
4. Verify file is in the correct path: `{user_id}/{timestamp}_{filename}`

### Test Cron Jobs

Manually trigger the jobs to verify they work:

```bash
# Test monthly refresh
curl -X POST http://localhost:3000/api/financial-concierge/jobs/monthly-refresh \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test weekly insights
curl -X POST http://localhost:3000/api/financial-concierge/jobs/weekly-insights \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Budget Generation

1. Complete the survey at `/finance/concierge/survey`
2. Navigate to `/finance/concierge/budget`
3. Click "Generate Budget Plan"
4. Verify budget is created with categories

### Test Insights Generation

1. Ensure you have transactions in the system
2. Navigate to `/finance/concierge/insights`
3. Click "Generate Insights"
4. Verify insights and recommendations appear

## Step 5: Optional - ML/Embedding Matcher

The ML categorization feature is marked as optional. To implement:

1. Choose an embedding model (OpenAI, Cohere, or local model)
2. Update `CategoryEngine` to include embedding-based matching
3. Add feature flag check for `conciergeMLCategorization`
4. Implement similarity matching between transaction descriptions and category embeddings

See `src/lib/financial-concierge/categoryEngine.ts` for the placeholder implementation.

## Troubleshooting

### Storage Upload Fails

- Verify bucket exists and is named `statement-files`
- Check bucket is private (not public)
- Verify RLS policies are applied
- Check file size limits
- Verify MIME type restrictions

### Cron Jobs Return 401

- Verify `CRON_SECRET` environment variable is set
- Check Authorization header matches exactly: `Bearer YOUR_CRON_SECRET`
- Verify secret is the same in both cron service and environment

### Budget Generation Fails

- Ensure user has completed survey
- Verify user has transactions in last 90 days
- Check user profile was created successfully
- Review server logs for specific errors

### Insights Not Generating

- Verify user has transactions
- Check user profile exists
- Ensure categories are set up
- Review InsightEngine logs for errors

## Next Steps

- Monitor cron job execution logs
- Set up alerts for failed cron jobs
- Review and adjust budget guardrails based on user feedback
- Enhance categorization rules based on usage patterns
- Add more insight types as needed

