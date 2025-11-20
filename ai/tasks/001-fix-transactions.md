# Task
Fix the bank statement import flow so that newly imported transactions
actually show up on both:
- The Finance **home** page
- The **transactions** page

# Current behavior
- I upload a bank statement and the UI shows a status like "Imported".
- However, the new transactions do **not** appear in the transactions list
  on the home page or on the /finance/transactions page.
- Supabase is being used for the `transactions` table.

# Expected behavior
- When a bank statement is imported:
  - New transactions should be inserted (or upserted) into the Supabase
    `transactions` table.
  - After import, the UI should either:
    - show the new transactions immediately, or
    - clearly refresh / re-fetch data so the lists are up to date.
- Transactions imported from the statement should be visible in:
  - `src/app/finance/page.tsx` (home dashboard)
  - `src/app/finance/transactions/page.tsx`

# Requirements
- Identify **where** the import logic lives (e.g. API route, server action,
  or client component handling the upload).
- Confirm that:
  - Parsed statement data is actually being written to Supabase.
  - The frontend pages re-fetch data (or use the updated cache) after import.
- If data is written correctly but not showing:
  - Fix the queries / filters used by the home and transactions pages
    so imported rows are included.
- If data is **not** written correctly:
  - Fix the insertion/upsert logic so that the parsed transactions are
    stored in the `transactions` table with the correct columns.
- Keep all TypeScript types consistent with existing `Transaction` types.
- Do not break existing manual transaction creation/editing if it exists.

# Hints / places to inspect
- Search for files containing words like:
  - "bank", "statement", "import", "upload", "csv", "parse"
- Likely areas:
  - API routes under `src/app/api/**`
  - Server actions or utilities under `src/lib/**`
  - Components under `src/app/finance/**` that render the upload/import UI.

# Files to focus on
- `src/app/finance/page.tsx`
- `src/app/finance/transactions/page.tsx`
- Any API route / server action / helper that handles **bank statement import**
  and writes to Supabase (the agent should locate these with shell commands).
- `src/lib/supabaseClient.ts`
- Any shared types for transactions (e.g. `src/types.ts` or similar).

# Testing / verification
- After changes:
  - Run `npm run lint` and fix any errors.
  - Run `npm run build` to ensure the project still builds.
- Manual behavior we want after the fix:
  1. Start the dev server.
  2. Import a bank statement (same way as now).
  3. See the newly imported transactions appear in the list on:
     - the home finance dashboard
     - the transactions page
