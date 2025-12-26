# Financial Concierge Setup Checklist

## ✅ Step 1: Database Migrations (COMPLETE)

- [x] Applied `019_financial_concierge_tables.sql`
- [x] Applied `020_seed_financial_categories.sql` (optional)
- [x] Applied `021_create_statement_files_bucket.sql` (storage policies)

## 📦 Step 2: Create Storage Bucket

### Quick Setup (Supabase Dashboard)

1. Go to **Supabase Dashboard** → **Storage**
2. Click **"New bucket"**
3. Configure:
   - Name: `statement-files`
   - Public: ❌ **No** (private)
   - File size limit: `10485760` (10MB)
   - Allowed MIME types: `application/pdf, text/csv`
4. Click **"Create bucket"**

### Or Use Setup Script

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run setup script
./scripts/setup-storage-bucket.sh
```

### Apply Storage Policies

After creating the bucket, apply RLS policies from migration `021_create_statement_files_bucket.sql`:

```sql
-- Run via Supabase SQL Editor or CLI
-- Policies ensure users can only access their own files
```

## ⏰ Step 3: Configure Cron Jobs

### Option A: Vercel (Already Configured)

The `vercel.json` file already includes cron job configuration:
- ✅ Monthly refresh: `0 2 1 * *` (2 AM UTC on 1st of month)
- ✅ Weekly insights: `0 3 * * 1` (3 AM UTC every Monday)

**Action Required:**
1. Set `CRON_SECRET` environment variable in Vercel dashboard
2. Generate a secure secret: `openssl rand -hex 32`
3. Add to Vercel project settings → Environment Variables

### Option B: External Cron Service

If not using Vercel, set up cron jobs with:

**Monthly Refresh:**
- URL: `https://your-domain.com/api/financial-concierge/jobs/monthly-refresh`
- Schedule: `0 2 1 * *`
- Method: POST
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

**Weekly Insights:**
- URL: `https://your-domain.com/api/financial-concierge/jobs/weekly-insights`
- Schedule: `0 3 * * 1`
- Method: POST
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

### Environment Variables

Add to your `.env.local` or production environment:

```env
# Required for cron jobs
CRON_SECRET=your-secure-random-string-here

# Plaid (if using)
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox  # or 'production'
```

## ✅ Step 4: UI Pages (COMPLETE)

All UI pages are implemented:
- ✅ Survey onboarding (`/finance/concierge/survey`)
- ✅ Concierge Dashboard (`/finance/concierge`)
- ✅ Budget Plan (`/finance/concierge/budget`)
- ✅ Insights (`/finance/concierge/insights`)
- ✅ Upload Statement (`/finance/concierge/upload`)
- ✅ Subscriptions (`/finance/concierge/subscriptions`)

## 🔧 Step 5: Optional - ML Categorization

ML categorization is implemented as a placeholder. To enable:

1. **Choose an embedding provider:**
   - OpenAI (text-embedding-3-small)
   - Cohere
   - Local model (e.g., sentence-transformers)

2. **Update `src/lib/financial-concierge/mlCategorizer.ts`:**
   - Implement `categorizeWithML()` function
   - Add embedding generation logic
   - Implement cosine similarity matching

3. **Enable in feature flags:**
   - ML categorization is gated behind `conciergeMLCategorization` flag
   - Only available in Premium+ tiers

4. **Add API key:**
   ```env
   OPENAI_API_KEY=your-key-here  # If using OpenAI
   ```

## 🧪 Testing Checklist

### Storage Bucket
- [ ] Upload a test PDF at `/finance/concierge/upload`
- [ ] Verify file appears in Supabase Storage dashboard
- [ ] Verify file path: `{user_id}/{timestamp}_{filename}`
- [ ] Test file download (should only work for file owner)

### Survey & Profile
- [ ] Complete survey at `/finance/concierge/survey`
- [ ] Verify profile is created/updated
- [ ] Check profile type matches survey responses

### Budget Generation
- [ ] Generate budget at `/finance/concierge/budget`
- [ ] Verify budget items are created
- [ ] Check guardrail adjustments are applied
- [ ] Test approval flow

### Insights Generation
- [ ] Generate insights at `/finance/concierge/insights`
- [ ] Verify insights appear
- [ ] Check recommendations are shown
- [ ] Test status updates on recommendations

### Categorization
- [ ] Upload statement with transactions
- [ ] Verify transactions are auto-categorized
- [ ] Check categorization confidence scores
- [ ] Test user override (change category)

### Cron Jobs
- [ ] Manually trigger monthly refresh job
- [ ] Verify transactions are synced
- [ ] Check budgets are generated
- [ ] Manually trigger weekly insights job
- [ ] Verify insights are regenerated

## 📝 Next Steps After Setup

1. **Monitor Usage:**
   - Check cron job execution logs
   - Monitor storage bucket usage
   - Track categorization accuracy

2. **Tune Categorization:**
   - Review merchant mappings
   - Add custom category rules
   - Adjust confidence thresholds

3. **Enhance Insights:**
   - Add more insight types
   - Refine recommendation logic
   - Improve goal progress tracking

4. **User Feedback:**
   - Collect feedback on budget suggestions
   - Improve guardrail logic
   - Enhance explainability

## 🐛 Troubleshooting

### Storage Upload Fails
- Check bucket exists: `statement-files`
- Verify bucket is private
- Check RLS policies are applied
- Verify file size < 10MB
- Check MIME type is PDF or CSV

### Cron Jobs Return 401
- Verify `CRON_SECRET` is set
- Check Authorization header format: `Bearer {secret}`
- Ensure secret matches in cron service and env

### Budget Generation Fails
- Ensure user completed survey
- Check user has transactions in last 90 days
- Verify user profile exists
- Check server logs for specific errors

### Categorization Not Working
- Verify categories exist in database
- Check merchant mappings table
- Review category rules
- Check server logs for errors

## 📚 Documentation

- **Implementation Guide**: `FINANCIAL_CONCIERGE_IMPLEMENTATION.md`
- **UX Polish Guide**: `FINANCIAL_CONCIERGE_UX_POLISH.md`
- **Setup Guide**: `docs/financial-concierge-setup.md`



