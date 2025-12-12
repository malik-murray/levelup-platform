# App Spec – Reflection → Lesson (`/reflection`)

## 1. Purpose

Convert personal reflections into clear lessons, action steps, and content ideas for LevelUpSolutions.

---

## 2. Core V1 Features

1. **Reflection Intake**
   - Text editor where Malik can paste a daily reflection or journal entry.
   - Option to set tags (e.g., mindset, money, relationships, spiritual).

2. **AI Transformation**
   - From one reflection, generate:
     - 3–5 key lessons.
     - 3 practical action steps.
     - 1–2 affirmations or reminders.
     - Optional: 1–3 content ideas (title + angle).

3. **Saved Lessons**
   - Save the reflection + generated output for later review.
   - Mark certain lessons or ideas as “starred” or “turned into content”.

---

## 3. Data Model

- `reflections`
  - `id`, `user_id`, `raw_text`, `tags[]`, `created_at`

- `reflection_outputs`
  - `id`, `reflection_id`, `lessons`, `actions`, `affirmations`, `content_ideas`, `created_at`

---

## 4. Pages

1. `/reflection`
   - New reflection form and recent entries.

2. `/reflection/[id]`
   - Show original reflection + generated output, with ability to edit text.

---

## 5. Out of Scope for V1

- Direct publishing to blog or social media
- Deep integration with habit or finance data (future opportunity)
