# LevelUpSolutions Platform – Master Goals

LevelUpSolutions is a personal operating system for habits, money, mindset, and growth.  
The goal: help users **design, track, and upgrade their life** through a set of focused apps that all share one account, one design system, and one data brain.

---

## 1. Core Principles

1. **One ecosystem, many apps**  
   - Each app solves a focused problem (finance, habits, emotions, etc.)  
   - Shared auth, shared design system, shared utility layer.

2. **Clarity over complexity**  
   - Interfaces feel calm, opinionated, and easy for beginners.  
   - Defaults are smart; power features are discoverable, not overwhelming.

3. **Gamified growth**  
   - Scores, streaks, and progress bars show users how they’re leveling up.  
   - Feedback loops: track → reflect → adjust → improve.

4. **Data-driven + AI-assisted**  
   - The platform stores rich data (transactions, habits, reflections, etc.).  
   - AI helps with insights, summarization, planning, and content generation.

5. **Mobile-first, keyboard-friendly**  
   - Feels great both on desktop and on a phone browser.

---

## 2. Tech & Architecture

- **Frontend**: Next.js 14 (App Router, TypeScript, React Server Components where useful)
- **Backend / DB**: Supabase (Postgres + Row Level Security)
- **Auth**: Supabase Auth
- **Styling**: TailwindCSS + shared UI components
- **Testing**: Jest + React Testing Library (where applicable)
- **Monorepo**: single repo with multiple app routes:
  - `/finance` – Finance Tracker
  - `/habit` – Habit Tracker
  - `/resume` – Resume Generator
  - `/emotions` – Emotional Tracker
  - `/markets` – Stock & Crypto Analyzer
  - `/newsfeed` – Newsfeed Summarizer
  - `/reflection` – Reflection → Lesson

Shared packages (future):

- `packages/ui` – shared design system
- `packages/utils` – date, money, scoring helpers, etc.
- `packages/api` – shared API client helpers

---

## 3. Product Vision by App (High-Level)

1. **Finance Tracker (`/finance`)**  
   A YNAB-inspired budgeting and cashflow tool:
   - Accounts, categories, and budgets
   - Transaction import & categorization
   - Monthly views, reports, and future Plaid integration

2. **Habit Tracker (`/habit`)**  
   “LevelUp Player One” – life as a game:
   - Daily habits, top 3 priorities, and to-do scores
   - Physical / Mental / Spiritual grades
   - XP-style scoring and weekly reports

3. **Resume Generator (`/resume`)**  
   Smart resume + cover letter generator:
   - Store user profile & experience
   - Paste job description → tailored resume & cover letter
   - Export as PDF / Word, track versions per job

4. **Emotional Tracker (`/emotions`)**  
   Emotional log tied to Malik’s eBook themes:
   - Track emotion, trigger, intensity, and coping strategy
   - Suggest Bible verses / reflections from the emotion library
   - Turn logs into insights & patterns over time

5. **Markets / Stock & Crypto Analyzer (`/markets`)**  
   Insight layer for ETH, stocks, and crypto:
   - Watchlists and basic portfolio tracking
   - Simple analytics + AI commentary
   - Long term: swing-trade notifier for Ethereum etc.

6. **Newsfeed Summarizer (`/newsfeed`)**  
   “The Daily Edge” – summarized world/newsfeed:
   - Pull or paste articles / feeds
   - Generate short summaries, takeaways, and CTAs
   - Organize by category (world, finance, tech, etc.)

7. **Reflection → Lesson (`/reflection`)**  
   Turn journal entries into lessons and content:
   - User writes or pastes a reflection
   - AI extracts lessons, affirmations, and action steps
   - Optionally convert into content ideas for LevelUpSolutions

---

## 4. Cross-App Rules for Cursor

When implementing features:

1. **CONSISTENT UI**
   - Use the shared layout (top navbar with logo + app grid).
   - Use the same colors, spacing, and card styles.

2. **SHARED CONCEPTS**
   - Money-related logic is centralized (currency formatting, budgets).
   - Scoring / grading logic for habits & emotions can be reused.

3. **APP BOUNDARIES**
   - Each app route owns its own domain logic and pages.
   - Shared utilities live in `packages` or `src/lib`, not copied between apps.

4. **ORDER OF EXECUTION (PRIORITY)**
   1. Finance Tracker – must be fully usable by Malik as a personal tool.
   2. Habit Tracker – daily scoring + basic UI.
   3. Reflection → Lesson – simple pipeline from text → lessons.
   4. Resume Generator – usable v1 for real job applications.
   5. Emotional Tracker – basic logging + verse suggestions.
   6. Markets app – ETH-focused analytics, then generalize.
   7. Newsfeed Summarizer – simple input → summary pipeline.

Always prioritize **stability + clarity** over adding new features.
