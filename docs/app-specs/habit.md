# App Spec – Habit Tracker (`/habit`)

## 1. Purpose

“LevelUp Player One” – a gamified habit and life tracker.  
Goal: turn Malik’s daily habits, priorities, and routines into a **score** that tracks physical, mental, spiritual progress.

---

## 2. Core V1 Features

1. **Daily Habits**
   - User defines habits with category (Physical, Mental, Spiritual, etc.).
   - Each habit can be daily/weekly and has an emoji/icon.
   - Check-in: ✅ = 1 point, 🥑 = 0.5 points (or similar scoring).

2. **Top 3 Priorities & To-Dos**
   - For each day: top 3 priorities + general task list.
   - Completion contributes to daily score.

3. **Daily Score & Grades**
   - Overall daily score (0–100).
   - Sub-grades: Physical / Mental / Spiritual.
   - A/B/C letter grade thresholds configurable in code.

4. **History View**
   - Calendar or list showing past days with scores.
   - Weekly summary: average scores, streaks.

---

## 3. Data Model

- `habit_templates`
  - `id`, `user_id`, `name`, `category`, `icon`, `is_active`

- `habit_entries`
  - `id`, `user_id`, `habit_id`, `date`, `status` (checked, half, missed)

- `daily_priorities`
  - `id`, `user_id`, `date`, `priority_1`, `priority_2`, `priority_3`

- `daily_tasks`
  - `id`, `user_id`, `date`, `title`, `is_done`

- `daily_scores`
  - `id`, `user_id`, `date`, `score_overall`, `score_physical`, `score_mental`, `score_spiritual`, `grade`

---

## 4. Pages / Flows

1. `/habit`
   - Today view: habits, priorities, tasks, and live score.
   - Quick actions to check in, add tasks, and edit habits.

2. `/habit/history`
   - List or calendar of past days with scores and grades.

3. `/habit/settings`
   - Manage habit templates.
   - Configure grade thresholds and category weights.

---

## 5. Out of Scope for V1

- Social features, leaderboards
- Deep analytics, charts beyond simple summaries
- Mobile app; we target responsive web only
