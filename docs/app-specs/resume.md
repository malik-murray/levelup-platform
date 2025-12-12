# App Spec – Resume Generator (`/resume`)

## 1. Purpose

Help users (starting with Malik) quickly generate job-specific resumes and cover letters using AI, based on a stored career profile and job description.

---

## 2. Core V1 Features

1. **Profile Management**
   - Store user info: name, contact, headline, summary.
   - Work experience: job title, company, dates, bullets.
   - Education, skills, certifications.

2. **Job Description Intake**
   - Text area to paste job description.
   - Optional: upload a JD file (out of scope for first iteration if needed).

3. **AI Resume & Cover Letter Generation**
   - Use OpenAI API to:
     - Select and rewrite bullets tailored to the JD.
     - Generate a one-page resume layout (sections).
     - Generate a matching cover letter.

4. **Version Management**
   - Save each generated resume/cover-letter pair as a `version` tied to a JD.
   - Ability to view previous versions.

5. **Export**
   - Basic export as printable HTML / PDF for now.

---

## 3. Data Model

- `profiles`
  - `id`, `user_id`, `name`, `headline`, `summary`, `location`, etc.

- `experiences`
  - `id`, `profile_id`, `title`, `company`, `start_date`, `end_date`, `bullets[]`

- `educations`, `skills`, `certifications` (simple lists)

- `job_descriptions`
  - `id`, `user_id`, `title`, `company`, `raw_text`

- `resume_versions`
  - `id`, `user_id`, `job_description_id`, `resume_html`, `cover_letter_html`, `created_at`

---

## 4. Pages / Flows

1. `/resume`
   - Dashboard: quick create – “Paste JD → Generate Resume”.

2. `/resume/profile`
   - CRUD UI for profile, experience, education, skills.

3. `/resume/jobs/[id]`
   - Show JD, generated resume and cover letter, regenerate/edit.

---

## 5. Out of Scope for V1

- Fancy PDF templates / theming
- Multi-user collaboration
- ATS-optimization scoring (maybe later)
