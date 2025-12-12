# App Spec – Finance Tracker (`/finance`)

## 1. Purpose

A YNAB-style budgeting app that helps users see where every dollar goes, plan their month, and make better money decisions.  
Primary user: Malik managing personal and family finances.

---

## 2. Core V1 Features

1. **Accounts**
   - List of accounts with name, type (checking, savings, credit, etc.), and current balance.
   - Ability to add, edit, archive accounts.
   - Credit card accounts show negative balances correctly and subtract from net worth.

2. **Transactions**
   - Table of transactions with: date, amount, payee/person, note, account, category.
   - CRUD: add, edit, delete, duplicate.
   - Bulk editing for category and account.
   - Import from parsed bank statements (existing parser).

3. **Categories & Budgets**
   - Category groups + subcategories (YNAB-style).
   - Budget input at subcategory level; groups show aggregated totals.
   - Columns: Assigned, Activity, Available.
   - Collapsible groups, progress bars on each row.
   - “Ready to Assign” summary at the top for the current month.

4. **Reports**
   - Simple monthly breakdown by category and account.
   - Net worth over time (sum of accounts).
   - Income vs Expenses chart.

5. **Month Navigation**
   - Switch between months (previous / next buttons, dropdown).
   - Each month has its own budgets and summary.

---

## 3. Data Model (Postgres via Supabase)

Tables (simplified):

- `accounts`
  - `id`, `user_id`, `name`, `type`, `initial_balance`, `is_active`

- `categories`
  - `id`, `user_id`, `name`, `type` (income/expense/transfer)
  - `kind` ('group' | 'category')
  - `parent_id` (nullable, points to group)

- `transactions`
  - `id`, `user_id`, `account_id`, `category_id`
  - `date`, `amount`, `person`, `note`

- `category_budgets`
  - `id`, `user_id`, `category_id`, `month` (YYYY-MM-01), `amount_assigned`

---

## 4. UX & Pages

1. `/finance`
   - Overview dashboard: total net worth, accounts summary, quick links.

2. `/finance/accounts`
   - Table of accounts; inline editing for balances and names.

3. `/finance/transactions`
   - Full transaction list with filters by month, account, category.
   - Transaction form drawer or modal.

4. `/finance/budget`
   - YNAB-style category group view.
   - Editable `Assigned` fields tied to `category_budgets`.
   - Summary section similar to “Ready to Assign”.

5. `/finance/reports`
   - Basic charts and breakdowns.

---

## 5. Out of Scope for V1

- Plaid integration
- Multi-currency support
- Shared family access / multiple users per budget
- Advanced rules-based auto-categorization (beyond simple helpers)

Focus V1 on making **Malik’s own finances fully trackable and budgetable**.
