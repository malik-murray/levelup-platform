# App Spec – Fitness Tracker / PeakMode (`/fitness`)

## 1. Purpose

Track workouts, movement, and meals in one place, with the long-term goal of syncing automatically from Apple Watch, Fitbit, and nutrition apps.  
This app gives a detailed view of **physical health**, while the Habit Tracker tracks high-level consistency and scores.

---

## 2. Core V1 Features

1. **Daily Fitness Dashboard**
   - Shows today’s:
     - Workouts
     - Steps / movement (manual entry or mock for now)
     - Calories in vs calories out (manual entries)
     - Water intake
   - Simple summary for the week (totals + streaks).

2. **Workouts Log**
   - Log workouts with:
     - Date & time
     - Type (strength, cardio, mobility, sport)
     - Muscle group / body part
     - Duration
     - Intensity (1–10)
     - Notes
   - View list of workouts with filters by date, type, and muscle group.

3. **Meals & Nutrition**
   - Log meals with:
     - Date & time
     - Meal type (breakfast / lunch / dinner / snack)
     - Short description
     - Estimated calories
     - Optional macros (protein, carbs, fats)
   - Daily totals for calories and macros.

4. **Metrics & Targets**
   - Track:
     - Weight
     - Body measurements (optional)
     - Daily goals: steps, calories, water, workout minutes
   - Simple progress chart for weight and weekly workout minutes.

5. **Integrations (Planning & Stubs)**
   - A **Connections / Integrations** settings page with:
     - Apple Health / Apple Watch (planned)
     - Fitbit
     - Popular food tracking apps (e.g., MyFitnessPal, Cronometer)
   - For V1:
     - No real API integration yet.
     - Create **service stubs** and data models so future sync jobs can write into the same tables:
       - `importWorkoutsFromProvider(provider, data)`
       - `importMealsFromProvider(provider, data)`
     - UI shows “Connected” / “Coming soon” mock states.

---

## 3. Data Model (Supabase, simplified)

- `fitness_workouts`
  - `id`, `user_id`
  - `date` (date or timestamptz)
  - `type` (strength/cardio/mobility/sport/other)
  - `muscle_group`
  - `duration_minutes`
  - `intensity` (1–10)
  - `calories_burned` (nullable)
  - `source` (manual/apple_watch/fitbit/other)
  - `source_id` (nullable, for external provider reference)
  - `notes`

- `fitness_meals`
  - `id`, `user_id`
  - `date`
  - `meal_type` (breakfast/lunch/dinner/snack)
  - `description`
  - `calories`
  - `protein_g`, `carbs_g`, `fat_g` (nullable)
  - `source` (manual/app_import)
  - `source_id` (nullable)

- `fitness_metrics`
  - `id`, `user_id`
  - `date`
  - `weight_kg` (or lbs with a unit field)
  - `steps`
  - `water_ml`
  - `sleep_hours` (optional)

- `fitness_goals`
  - `id`, `user_id`
  - `daily_steps_target`
  - `daily_calories_target`
  - `daily_water_ml_target`
  - `weekly_workout_minutes_target`

- `fitness_integrations`
  - `id`, `user_id`
  - `provider` (apple_health, fitbit, myfitnesspal, etc.)
  - `status` (connected, disconnected, coming_soon)
  - `last_synced_at`

---

## 4. Pages

1. `/fitness`
   - Today’s dashboard (today + quick weekly summary).
   - Cards for:
     - Workouts (today + add button)
     - Meals (today + add button)
     - Metrics (weight, steps, water)
     - Weekly overview.

2. `/fitness/workouts`
   - Table/list of workouts.
   - Filters by date range, type, muscle group.
   - Button to log new workout (inline or separate page).

3. `/fitness/meals`
   - Table/list of meals.
   - Daily totals at top (calories + macros).
   - Button to log new meal.

4. `/fitness/metrics`
   - Chart of weight over time.
   - Chart of weekly workout minutes / steps.

5. `/fitness/settings/integrations`
   - List of integrations with status:
     - Apple Watch / Apple Health – “Connect (coming soon)”
     - Fitbit – “Connect (coming soon)”
     - Nutrition App – “Connect (coming soon)”
   - Uses the `fitness_integrations` table, but allows toggling mock status only for now.

---

## 5. Out of Scope for V1

- Real Apple Health / Fitbit API integrations
- Background sync jobs or webhooks
- Detailed workout programming (plans, blocks, periodization)
- Complex nutrition planning

V1 is about **manual tracking + a clean dashboard**, with the DB and service layer ready for future automated imports.
