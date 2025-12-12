# App Spec – Newsfeed Summarizer (`/newsfeed`)

## 1. Purpose

“The Daily Edge” – short, powerful summaries of news and long-form content so users can stay informed without drowning in information.

---

## 2. Core V1 Features

1. **Input Sources**
   - Text area to paste an article, thread, or newsletter.
   - Optional: URL input (can just fetch manually for now).

2. **AI Summary**
   - Generate:
     - 3–5 bullet summary
     - One-sentence “headline” summary
     - Optional “Why this matters” section.

3. **Categories**
   - Tag each summary as: World, Finance, Tech, Personal Development, etc.

4. **History**
   - List of past summaries with search/filter.

---

## 3. Data Model

- `summaries`
  - `id`, `user_id`, `title`, `category`, `source_type`, `source_text`, `summary`, `why_it_matters`, `created_at`

---

## 4. Pages

1. `/newsfeed`
   - “New summary” form + recent list.

2. `/newsfeed/[id]`
   - Detail page for a single summary.

---

## 5. Out of Scope for V1

- Automatic RSS / Twitter / YouTube integration
- Email newsletter sending
