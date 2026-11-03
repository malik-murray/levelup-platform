# LevelUpOS: first AgentOS integration

LevelUpOS keeps the existing Next.js/Vercel application and Supabase login. The
new `/levelupos` page submits workouts to a separately hosted AgentOS runtime.
The Manager Agent writes a brief, then the Workout Agent generates a plan.
The backend stores the request, status, result and timestamps in PostgreSQL.
Closing the browser does not stop the job. This is the first vertical slice;
recurring scheduling, notifications, approvals, dollar spend tracking, and writing
plans into the existing fitness tables are not implemented yet.

## Deploy the backend on Railway

1. Create a Railway project with PostgreSQL and a service sourced from this repo
   on the integration branch. Set its **Root Directory** to `services/agentos`.
   Choose its Dockerfile and use the Railway configuration file in that directory.
2. Add environment variables using `services/agentos/.env.example` as the reference:
   - `DATABASE_URL`: reference the Railway PostgreSQL service's connection URL.
   - `OPENAI_API_KEY`: a model provider key, entered directly in Railway secrets.
   - `OS_SECURITY_KEY`: generate a random secret (`openssl rand -hex 32`).
   - `LEVELUPOS_MODEL`: defaults to `gpt-4o-mini`; choose another compatible model
     explicitly if needed and review its pricing before switching.
   - `AGNO_TELEMETRY=false`.
3. Run **one replica, one Uvicorn worker**, with no overlapping deploys. The first
   version uses one sequential background worker and a PostgreSQL submission lock.
   Do not enable horizontal scaling or rolling overlap without adding job leases.
4. Generate a public HTTPS domain. `/healthz` is the unauthenticated liveness probe.
   Authenticated `/levelupos/health` checks database connectivity, worker and model
   key presence. It cannot verify model billing or credentials without a paid call.
5. Railway must keep this service running; do not enable sleeping/serverless mode
   for an ongoing background worker. Review its memory/CPU usage and billing.

## Connect a Vercel preview first

Add these **server-only** Vercel environment variables to the integration preview:

```text
LEVELUPOS_AGENTOS_URL=https://YOUR-AGENTOS-DOMAIN
LEVELUPOS_AGENTOS_KEY=THE-SAME-OS_SECURITY_KEY
```

Do not prefix either with `NEXT_PUBLIC_`. Keep existing Supabase configuration.
Redeploy the preview, sign in, open `/levelupos`, and submit one short request.
Confirm queued/running/completed transitions and reload to verify persistence.
Sign in as another user and confirm the first user's run is absent. Test failure
handling with an invalid model key in a test deployment, then restore it.
Only promote after this live smoke test. The source repo has not been confirmed
against the current Vercel project; confirm its connected repository and branch.

## Access and cost boundaries

- The Next.js routes derive identity from verified Supabase authentication; browser
  input cannot select another user. The backend trusts only the server's shared key.
- Every AgentOS route except `/healthz` requires that key. Do not share it with
  browsers or clients. Agno's hosted live control plane is optional and not used.
- The backend stores explicit text submitted on the new page. It does not read
  existing fitness profiles or send finance/history data to the model.
- Defaults: **5 submissions per user per UTC day, 25 globally**, one active job per
  user, one job executing globally. Requests are capped at 2,000 characters. Each
  workflow makes two bounded agent calls (500 and 1,800 maximum completion tokens),
  with a 180-second overall timeout and no automatic model retries.
- These limits are usage controls, **not dollar billing caps**. Configure provider
  and Railway spend alerts/limits separately. Model and hosting charges apply.
- Submission IDs are idempotent; the browser retains an ID after network errors.
  Queued jobs persist across restarts; interrupted running jobs become visibly
  failed after a four-minute recovery window and are not retried automatically.
  Row locks prevent duplicate claims during deployment overlap. Review before retrying.
- Results are plain text escaped by React, never rendered as executable HTML.
- Run history is retained in the backend database (the UI shows the last 20).
  Add retention/deletion controls before expanding beyond a personal pilot.

## Local verification

To inspect the interface without credentials, run the development server with
`LEVELUPOS_LOCAL_PREVIEW=true`, a syntactically valid placeholder Supabase URL/key,
and open `/levelupos/preview`. This route is available only in development and
displays clearly labeled read-only fixtures; it never bypasses real API or page
authentication. For example, on macOS/Linux:

```sh
npm ci
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-preview LEVELUPOS_LOCAL_PREVIEW=true npm run dev -- --webpack
```

Open `http://localhost:3000/levelupos/preview`. To run real jobs, configure your
actual Supabase values in `.env.local`, start the backend as described below,
set the server-only backend URL/key, and use `/levelupos` after signing in.

Frontend:

```sh
npm ci
npm test -- --runInBand src/app/api/levelupos/jobs/route.test.ts
```

Backend (Python 3.12):

```sh
python -m venv /tmp/levelupos-venv
/tmp/levelupos-venv/bin/pip install -r services/agentos/requirements.txt pytest httpx
/tmp/levelupos-venv/bin/python -m pytest services/agentos/tests -q
```

Tests use temporary SQLite databases and fake model execution, not billable calls.
For local manual execution, copy the backend env example to an ignored `.env`, use
a local PostgreSQL database or a persistent SQLite URL, and run Uvicorn with env
loading from that directory. Set the frontend URL to `http://localhost:8000` only
in development. Production requires HTTPS.

## Licensing

Agno is installed as an Apache-2.0 dependency; its license remains with the
distribution. This integration does not copy the AgentOS template. Product
branding is LevelUpOS. Existing app features, artwork, and routes are preserved.
