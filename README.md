# Gym Journal & Scheduler

Plan your workouts by day and muscle group, then log the sets/reps/weight you actually did. Mobile-first, built with Next.js (App Router) + Supabase.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migration in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then the seed data in [`supabase/seed.sql`](supabase/seed.sql) (adds muscle groups + a starter exercise library).
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

- **Exercises** (`/exercises`) — a shared library tagged with one or more muscle groups; add your own custom exercises.
- **Schedule** (`/schedule/[date]`) — pick muscle groups for a day, pick exercises, set target sets/reps.
- **Log** (`/log/[date]`) — record what you actually did; pre-filled from that day's schedule if one exists, or start freeform. Add/remove sets, record reps + weight per set.
- **Calendar** (`/calendar`) — week view of what's scheduled and what's been logged.
- **History** (`/history`) — past logs, filterable by exercise (e.g. track bench press progress over time).

Data model, RLS policies, and everything else live in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
