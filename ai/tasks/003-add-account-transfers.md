# Task
Add a "Transfer between accounts" feature to the LevelUp Financial app so I can move money
between my own accounts (e.g. checking → credit card) without affecting income/expense totals.

# Context
- We are using Next.js 14 (App Router, TS) with Supabase.
- Table `transactions` now has these extra columns:
  - `is_transfer boolean NOT NULL DEFAULT false`
  - `transfer_group_id uuid NULL`
- Account balances are derived from sums of `transactions.amount` per account.
- The transactions page already:
  - Loads `transactions` for a selected month.
  - Maps related `accounts` and `categories`.
  - Shows "Uncategorized" / "No account" when relationships are null.
  - Computes:
    - `totalIn` = sum of positive amounts
    - `totalOut` = sum of negative amounts
    - `net` = `totalIn - totalOut`

# Requirements

## Data model / queries
1. Update the types and Supabase `select` on the transactions page to include:
   - `is_transfer`
   - `transfer_group_id`
   for each transaction row.
2. When mapping DB rows to the local `Transaction` type, include `is_transfer`.
3. Ensure that:
   - Transfers are still visible in the transactions list like any other row.
   - Transfers DO NOT count toward:
     - income totals
     - expense totals
     - net (these should reflect only "real" income/expenses, not internal moves).

## Transfer behavior
4. Implement a transfer as **two linked transactions**:
   - One row for money leaving the source account:
     - `amount` is negative.
   - One row for money entering the destination account:
     - `amount` is positive.
   - Both rows:
     - share the same `transfer_group_id` (a new UUID)
     - have `is_transfer = true`
     - write a clear `person` label like: `Transfer: {fromAccountName} → {toAccountName}`
     - can reuse a shared `note` entered by the user (or be null).
5. This should work for scenarios such as:
   - Checking paying off a credit card.
   - Moving money from checking → savings.
   - Any account → any account (as long as they're both owned by the same user).

## UI / UX
6. On `src/app/finance/transactions/page.tsx`:
   - Load the list of `accounts` so that the user can pick:
     - a "From" account
     - a 


