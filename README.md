# Gym Journal & Scheduler

Plan your workouts by day and muscle group, then log the sets/reps/weight you actually did. Mobile-first, built with Next.js (App Router) + Supabase.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run every file in [`supabase/migrations/`](supabase/migrations) in filename order (`0001_init.sql` first). Migrations `0021` and `0027` build the shared exercise library; [`supabase/seed.sql`](supabase/seed.sql) is optional, safe to re-run, and skips exercises the library already has.
   - If you use the Supabase CLI instead: `supabase link` then `supabase db push`, followed by `psql < supabase/seed.sql` (or paste it into the SQL editor).
3. In Project Settings → API, copy the Project URL and `anon` public key.
4. Copy `.env.local.example` to `.env.local` and fill in those two values.
5. In Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (and your deployed URL's equivalent) as a redirect URL — this project uses email magic-link sign-in.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with your email (a magic link is sent — no password).

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

`npm test` runs the unit tests. The SQL functions (training stats, exercise browsing) have their own checks in [`supabase/tests/`](supabase/tests), which need a database with every migration applied — e.g. a local Supabase (`supabase start`):

```bash
for f in supabase/tests/*.sql; do psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f "$f"; done
```

Each runs in a transaction that is rolled back.
