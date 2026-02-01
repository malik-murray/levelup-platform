# Newsfeed Article Ingestion Setup

## Overview

The newsfeed now has a complete article ingestion pipeline that automatically fetches articles from RSS feeds and stores them in the database.

## Database Schema

### Tables Created/Updated

1. **`newsfeed_articles`** (existing, enhanced)
   - Added `image_url` column for article images
   - Added `raw_json` column for storing full RSS item data
   - Added unique constraint on `url` to prevent duplicates
   - Indexes: `url`, `publish_time DESC`, `source_id`, `topic_ids` (GIN)

2. **`newsfeed_sources`** (existing, enhanced)
   - Added `rss_feed_url` column for RSS feed URLs
   - Populated with RSS feed URLs for all active sources

3. **`newsfeed_user_article_actions`** (existing)
   - RLS policies added for user-specific access

### RLS Policies

- **Articles**: All authenticated users can read articles
- **User Actions**: Users can only read/manage their own saved/archived actions
- **Ingestion**: Uses service role key (bypasses RLS)

## Migration

Run the migration to update the schema:

```sql
-- File: supabase/migrations/032_newsfeed_articles_schema_upgrade.sql
```

This migration:
- Adds RSS feed URLs to sources
- Adds `image_url` and `raw_json` columns to articles
- Creates unique constraint on article URLs
- Sets up RLS policies
- Adds performance indexes

## Installation

Install the RSS parser dependency:

```bash
npm install rss-parser
```

## Environment Variables

Optional (for production):
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for ingestion (bypasses RLS)
  - If not set, falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Service role key is recommended for ingestion to bypass RLS

## How Ingestion Works

### 1. RSS Fetcher (`src/lib/newsfeed/rssFetcher.ts`)

- Fetches articles from RSS feed URLs
- Parses RSS items and extracts:
  - Title, URL, publish date
  - Description/summary
  - Image URL (from enclosures or content)
  - Raw RSS data (for future processing)

### 2. Article Ingestion (`src/lib/newsfeed/articleIngestion.ts`)

- Fetches articles from selected sources (or all active sources)
- Normalizes URLs (removes tracking parameters)
- Deduplicates by URL (upsert on conflict)
- Inserts articles in batches (50 at a time)
- Returns ingestion statistics

### 3. Auto-Fetch on Feed Load

The `/api/newsfeed/articles` endpoint automatically triggers ingestion if:
- No articles found in the last 36 hours
- Total articles in database < 10

This ensures the feed always has fresh content when users visit.

### 4. Manual Fetch Endpoint

**POST `/api/newsfeed/fetch`**

Manually trigger article fetching:

```bash
# Fetch from all active sources
curl -X POST http://localhost:3000/api/newsfeed/fetch \
  -H "Content-Type: application/json" \
  -d '{}'

# Fetch from specific sources
curl -X POST http://localhost:3000/api/newsfeed/fetch \
  -H "Content-Type: application/json" \
  -d '{"sourceIds": ["uuid1", "uuid2"]}'
```

**Authentication:**
- Requires authenticated user OR
- Service key in Authorization header: `Bearer <SERVICE_ROLE_KEY>`

## Scheduled Jobs (Future)

For production, set up a cron job to call `/api/newsfeed/fetch` periodically:

```bash
# Example: Run every 6 hours
0 */6 * * * curl -X POST https://your-domain.com/api/newsfeed/fetch \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Or use a service like:
- Vercel Cron Jobs
- GitHub Actions (scheduled workflows)
- Supabase Edge Functions (scheduled)
- External cron service (cron-job.org, etc.)

## Article Flow

1. **User visits feed** → `/api/newsfeed/articles`
2. **Check for articles** in last 36 hours
3. **If empty/stale** → Auto-fetch from RSS feeds
4. **Fetch articles** from selected sources (or all if none selected)
5. **Normalize & dedupe** by URL
6. **Insert into database** (upsert on URL conflict)
7. **Re-query** and return articles to user

## RSS Feed URLs

RSS feed URLs are stored in `newsfeed_sources.rss_feed_url` and include:

- **Tech**: Hacker News, TechCrunch, The Verge, Ars Technica, Wired, etc.
- **News**: Reuters, BBC, The Guardian, NPR, AP News, PBS, CNN, ABC
- **Business**: Bloomberg, Financial Times, The Economist, WSJ, MarketWatch
- **Science**: Scientific American, Nature, Science Magazine, National Geographic
- **World**: Al Jazeera, Deutsche Welle, France 24, NY Times

## Verification

After setup, verify ingestion:

1. **Check database:**
   ```sql
   SELECT COUNT(*) FROM newsfeed_articles;
   SELECT source_id, COUNT(*) 
   FROM newsfeed_articles 
   GROUP BY source_id;
   ```

2. **Check logs:**
   - Server logs show ingestion progress
   - Look for: "Auto-fetching articles from RSS feeds..."
   - Look for: "✅ Auto-fetch complete: { sourcesProcessed, articlesFetched, articlesInserted }"

3. **Load feed:**
   - Visit `/newsfeed`
   - Should see articles from selected sources
   - Check browser console for any errors

## Troubleshooting

**No articles appearing:**
- Check if RSS feed URLs are populated: `SELECT name, rss_feed_url FROM newsfeed_sources WHERE is_active = true;`
- Check server logs for fetch errors
- Verify `rss-parser` is installed
- Check network connectivity (RSS feeds must be accessible)

**Duplicate articles:**
- Unique constraint on `url` should prevent duplicates
- If duplicates exist, check URL normalization logic

**RLS errors:**
- Ensure service role key is set for ingestion
- Check RLS policies are correctly applied

**Slow ingestion:**
- RSS feeds are fetched sequentially (one at a time)
- Consider parallel fetching for production (future enhancement)
