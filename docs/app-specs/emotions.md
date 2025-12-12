# App Spec – Emotional Tracker (`/emotions`)

## 1. Purpose

Let users log emotions, triggers, and responses and connect them to spiritual lessons (aligned with Malik’s eBook about emotions and scriptures).

---

## 2. Core V1 Features

1. **Emotion Log**
   - For each entry: emotion, intensity (1–10), trigger, notes, date/time.
   - Optional tags (work, family, health, etc.).

2. **Scripture / Lesson Suggestions**
   - Simple mapping from emotion → list of verses or short lessons.
   - After logging, show relevant verse/lesson with reflection prompt.

3. **History**
   - List of past entries with filter by emotion and tag.
   - Simple stats: most common emotions, average intensity.

---

## 3. Data Model

- `emotion_entries`
  - `id`, `user_id`, `emotion`, `intensity`, `trigger`, `notes`, `tags[]`, `created_at`

- `emotion_resources`
  - `id`, `emotion`, `verse_ref`, `verse_text`, `lesson`, `prompt`

(These can be seeded from Malik’s book manually or via migration.)

---

## 4. Pages

1. `/emotions`
   - Today / recent entries list.
   - Button: “Log Emotion”.

2. `/emotions/new`
   - Form to add a new emotion entry.
   - After submit: show suggested resources.

3. `/emotions/history`
   - Filters by emotion/tag.
   - Basic stats.

---

## 5. Out of Scope for V1

- Advanced charts
- Integration with other apps’ data (habits/finance) – can come later
