# Gym Journal & Scheduler

Plan your workouts by day and muscle group, then log the sets/reps/weight you actually did. Mobile-first, built with Next.js (App Router) + Supabase.

## Local development

Needs Node 22 and Docker. The Supabase config is in [`supabase/config.toml`](supabase/config.toml).

```bash
npm ci
npm run db:start              # local Supabase: every migration in supabase/migrations + seed.sql
npx supabase status -o env    # URL and keys for .env.local (see .env.local.example)
npm run dev                   # http://localhost:3000
```

Copy `.env.local.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` (the local API URL),
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from that output. Sign up in the app,
or sign in with a magic link from the local mail viewer (`npx supabase status` prints its URL).
`npm run db:reset` rebuilds the database from the migrations; `npm run db:stop` shuts it down.

## Deploying

Vercel deploys the app from `master`. Database changes are migrations in
[`supabase/migrations/`](supabase/migrations), applied to production by the **Migrate production
database** workflow ([`.github/workflows/migrate.yml`](.github/workflows/migrate.yml)) whenever a
merge to `master` adds one. It dry-runs first and applies them with `supabase db push`.

**One-time setup** (until then the workflow is skipped):

1. In GitHub → Settings → Secrets and variables → Actions, add the variable `SUPABASE_PROJECT_REF`
   (the project ref, e.g. from the dashboard URL) and the secrets `SUPABASE_ACCESS_TOKEN` (a
   [personal access token](https://supabase.com/dashboard/account/tokens)) and
   `SUPABASE_DB_PASSWORD` (the database password).
2. If migrations were ever applied by hand in the SQL editor, record them in the project's migration
   history once, so they aren't re-run:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase migration list          # "Remote" is blank for migrations applied by hand
   npx supabase migration repair --status applied 0001 0002 …   # only those actually applied
   ```
   The workflow refuses to run while this is needed.
3. Optionally, add required reviewers to the `production` environment (Settings → Environments) to
   approve each migration run.
4. In Supabase → Authentication → URL Configuration, add the deployed URL's `/auth/callback` as a
   redirect URL (magic-link sign-in and password resets land there).

**Write migrations that the running app survives.** Vercel and the migration workflow run at the same
time, so for a minute the old app may meet the new schema, or the new app the old one. Add before you
remove: new columns nullable or defaulted, new function signatures alongside the old ones (the old one
can call the new), and drop old ones only in a later release once nothing uses them.

## How it works

- **Exercises** (`/exercises`) — a shared library of ~740 exercises tagged with muscle groups, plus your own custom exercises. Browse muscle group → exercise → tutorial: a group lists 10 exercises at a time ("Load more" for the next 10), and an exercise's tutorial (step-by-step instructions and a two-frame start/end demo) loads when you tap its name. Search and the equipment filter page through matches the same way. The log and schedule pickers use the same browser, and the logger shows the tutorial under "How to".
  - Most of the library and all demo photos come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense). [`scripts/import-free-exercise-db.mjs`](scripts/import-free-exercise-db.mjs) generates migration `0027` and the resized images in `public/exercise-demos/` from a pinned commit of the dataset.
  - The pages read the library through a small JSON API (signed-in only): `GET /api/exercises?muscleGroup=&q=&equipment=&cursor=` (one page, keyset-paginated), `GET /api/exercises/groups?q=&equipment=` (counts per muscle group) and `GET /api/exercises/:id` (one tutorial). The contract lives in [`src/lib/exerciseLibrary.ts`](src/lib/exerciseLibrary.ts); the paging and search run in SQL (migration `0028`).
- **Schedule** (`/schedule/[date]`) — pick muscle groups for a day, pick exercises, set target sets/reps — or mark the day as **Rest** (planned recovery) or **Absence** (sick, travel, injury). A day off marked after its date has passed is flagged "marked afterwards" (decided by the database, migration `0029`).
- **Log** (`/log/[date]`) — record what you actually did; pre-filled from that day's schedule if one exists, or start freeform. Add/remove sets, record reps + weight per set.
- **Calendar** (`/calendar`) — week view of what's scheduled and what's been logged. A planned workout on a past day with nothing logged shows as "planned, not logged" — worked out from the plan and the log, never labelled by hand.
- **Streaks and comebacks** (Today) — a week that falls short of your weekly goal is paused, not broken, when absence days cover the shortfall (at most 2 paused weeks in any 4). After 7+ days without a workout, Today welcomes you back and offers a lighter version of the day's plan: about two thirds of the sets, with "Same as last time" at ~90% weight (`lib/analyze/comeback.ts`).
- **History** (`/history`) — past logs, filterable by exercise (e.g. track bench press progress over time).

Data model, RLS policies, and everything else live in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Tests

```bash
npm test            # unit tests (Vitest)
npm run test:sql    # SQL checks in supabase/tests — needs `npm run db:start` and psql
npm run test:e2e    # Playwright end-to-end specs — needs `npm run db:start`; see e2e/README.md
```

The SQL checks and end-to-end specs run against a real database; each SQL file runs in a transaction
that is rolled back. CI runs all three on every pull request: the `integration` job starts a local
Supabase (applying every migration from scratch), then runs the SQL checks and the end-to-end specs
against the production build.
