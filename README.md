# Gym Journal & Scheduler

Plan your workouts by day and muscle group, then log the sets/reps/weight you actually did. Mobile-first, built with Next.js (App Router) + Supabase.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in [`supabase/migrations`](supabase/migrations) in order (`0001` → `0003`), then the seed data in [`supabase/seed.sql`](supabase/seed.sql) (adds muscle groups + a starter exercise library).
   - If you use the Supabase CLI instead: `supabase link` then `supabase db push`, followed by `psql < supabase/seed.sql` (or paste it into the SQL editor).
3. In Project Settings → API, copy the Project URL, the `anon` public key, and the `service_role` secret key.
4. Copy `.env.local.example` to `.env.local` and fill in all three values. `SUPABASE_SERVICE_ROLE_KEY` is server-only (never exposed to the browser) and is required for account deletion — the app will still run without it, but the "Delete account" action will fail until it's set.
5. In Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (and your deployed URL's equivalent) as a redirect URL. This single callback route handles magic-link sign-in, sign-up confirmation, and password-reset links.
6. Decide whether to require email confirmation: Authentication → Providers → Email → "Confirm email". Either setting works with this app — see [Authentication](#authentication) below for how each is handled.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register with an email + password, or sign in with a magic link.

## Authentication

- **Register** (`/register`) — email + password. If your Supabase project has "Confirm email" enabled, the new account is created unconfirmed and the user must click the emailed link before signing in; the UI reflects this ("check your email") rather than assuming success. If confirmation is disabled, the user is signed in immediately.
- **Sign in** (`/login`) — password or magic link. A password sign-in against an unconfirmed account surfaces a clear error with a "resend confirmation email" action.
- **Forgot / reset password** (`/forgot-password`, `/reset-password`) — requesting a reset always shows the same generic success message, whether or not the email is registered, to avoid revealing account existence.
- **Protected routes** — enforced in `src/middleware.ts` (via `src/lib/auth/route-guard.ts`); unauthenticated visitors are redirected to `/login?next=<original path>` and returned there after signing in.
- **Sign out** — from Profile; invalidates the Supabase session and redirects to `/login`.
- **Delete account** (`/profile`) — requires typing `DELETE` to confirm. Permanently deletes the Supabase Auth user via the service-role admin API, which cascades (via `ON DELETE CASCADE` foreign keys) to the user's profile, exercises, plans, and logs. This is a real deletion, not a hidden/soft-deleted profile.

## How it works

- **Exercises** (`/exercises`) — a shared library tagged with one or more muscle groups; add your own custom exercises.
- **Schedule** (`/schedule/[date]`) — pick muscle groups for a day, pick exercises, set target sets/reps.
- **Log** (`/log/[date]`) — record what you actually did; pre-filled from that day's schedule if one exists, or start freeform. Add/remove sets, record reps + weight per set.
- **Calendar** (`/calendar`) — week view of what's scheduled and what's been logged.
- **History** (`/history`) — past logs, filterable by exercise (e.g. track bench press progress over time).

Data model, RLS policies, and everything else live in [`supabase/migrations`](supabase/migrations).

## Development

- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — production build
- `npm test` — Vitest unit tests (pure logic + Server Actions with the Supabase client mocked; see `docs/technical-architecture-v1.md` for what is and isn't covered this way, and the Phase 1 implementation report for a manual verification checklist covering real Supabase-backed flows).

CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, and tests on every push/PR.
