# Task
Investigate why transactions inserted into Supabase by the bank statement
import are not appearing on the finance home and transactions pages, even
though rows exist in the `transactions` table.

# Steps
1) Inspect the Supabase queries used in:
   - src/app/finance/page.tsx
   - src/app/finance/transactions/page.tsx

2) Determine which filters are applied, such as:
   - user_id / profile_id
   - month / monthStr
   - is_archived / is_deleted / is_active
   - any other boolean or enum conditions.

3) Locate the code that performs the bank statement import and inserts rows
   into the `transactions` table.

4) Compare:
   - The fields and values required by the frontend queries.
   - The fields actually set on imported transaction rows.

5) Change either:
   - The import logic to set all required fields (preferred), OR
   - The queries to better match the current schema, while keeping the
     ability to filter by user and by month intact.

6) After making changes:
   - Ensure that importing a statement creates rows that are visible when
     viewing the matching month on:
     - /finance
     - /finance/transactions

7) Keep TypeScript types in sync and avoid any `any` casts.

# Files to focus on
- src/app/finance/page.tsx
- src/app/finance/transactions/page.tsx
- Any file that handles parsing and inserting bank statement data into the
  `transactions` table (agent should discover using shell search).
- src/lib/supabaseClient.ts
