# Gym-Journo — Technical Architecture v1

Status: Draft for product-owner/tech review (Phase 0 output). Not yet approved.

## 1. Application Architecture

- **Framework**: Next.js 16.3.5, App Router, React 19.2.8, TypeScript, Tailwind CSS v4.
- **Rendering model**: Server Components fetch data directly (via `src/lib/queries.ts`) inside `async` page components; mutations go through Server Actions (`"use server"` files colocated per route, e.g. `src/app/log/[date]/actions.ts`). No client-side data-fetching library (no React Query/SWR) and no client-side global state manager — state is local `useState` per form plus `router.refresh()` to re-pull server data after a mutation.
- **Structure**: `src/app/<feature>/page.tsx` (+ `actions.ts` for mutations, `+FormComponent.tsx` for the interactive client piece). This is a consistent, easy-to-follow pattern and should be kept as the convention for new features.
- **Auth/session plumbing**: `src/lib/supabase/{client,server,middleware}.ts` — standard `@supabase/ssr` cookie-based session pattern. `src/middleware.ts` runs on every non-static request, refreshes the session, and enforces two gates: (1) unauthenticated → redirect to `/login`, (2) authenticated but `profiles.onboarded = false` → redirect to `/onboarding`. This is the single source of route protection today; individual pages do not re-check auth (they rely on RLS to prevent data leaks if that assumption is ever wrong).
- **No API routes** beyond `/auth/callback` (OAuth/magic-link code exchange). All other data access is Server Components + Server Actions talking to Supabase directly — there is no separate backend/API layer.

## 2. Database Architecture

Postgres via Supabase. Three migrations so far, applied in order, no down-migrations, no migration tooling committed (README says "paste into SQL editor" or `supabase db push`; no CI applies migrations automatically).

Tables (see `supabase/migrations/0001_init.sql`, `0002_add_rest_day.sql`, `0003_add_profiles.sql`):

- `muscle_groups` — global lookup, `id, name`.
- `exercises` — `user_id nullable` (null = global/seeded, non-null = user-owned custom exercise).
- `exercise_muscle_groups` — join table, exercise ↔ muscle group (many-to-many).
- `workout_plans` — one row per `(user_id, date)`, has `title`, `is_rest_day`.
- `workout_plan_muscle_groups` — join table, plan ↔ muscle group.
- `planned_exercises` — belongs to a plan, references an exercise, has `target_sets`, `target_reps`, `position`.
- `workout_logs` — one row per `(user_id, date)`, optional FK to the plan it came from, `notes`, `completed_at`.
- `logged_exercises` — belongs to a log, references an exercise, `position`.
- `logged_sets` — belongs to a logged exercise, `set_number, reps, weight, weight_unit`.
- `profiles` — one row per user (`id = auth.users.id`), `full_name, age, height_cm, weight_kg, sex, goal, onboarded`.

This is a clean, normalized schema for its current scope. It already gets the most important structural decision right: **`workout_plans`/`planned_exercises` and `workout_logs`/`logged_exercises`/`logged_sets` are fully separate table hierarchies**, linked only by an optional `plan_id` on the log. That is exactly the planned-vs-actual separation the product spec requires, and it should be preserved and extended (never merged) as the schema grows.

## 3. Core Entities & Relationships (current, as ER summary)

```
auth.users 1─1 profiles
auth.users 1─N exercises (user-owned only; global exercises have user_id = null)
auth.users 1─N workout_plans (unique per date)
auth.users 1─N workout_logs (unique per date)

exercises N─M muscle_groups          (exercise_muscle_groups)
workout_plans N─M muscle_groups      (workout_plan_muscle_groups)
workout_plans 1─N planned_exercises → exercises
workout_logs 1─N logged_exercises → exercises
logged_exercises 1─N logged_sets
workout_logs N─1 workout_plans (optional, on delete set null)
```

## 4. Authentication Architecture

- Supabase Auth, `@supabase/ssr` cookie-based sessions, no custom JWT handling.
- Two sign-in modes: password (`signInWithPassword`) and magic link (`signInWithOtp`, `shouldCreateUser: true` — this doubles as implicit registration).
- Password is actually set **after** the fact, during onboarding (`auth.updateUser({ password })`), once a session already exists from the magic link. There is no dedicated "create account with password" entry point today.
- Missing pieces (see product spec §11 for the target): forgot-password/reset flow, explicit sign-up screen, email verification gating, account deletion.
- Account deletion, when added, requires the Supabase **service role** key (admin API) to delete an `auth.users` row — this must be a server-only code path (e.g., a Server Action or dedicated server route) and the service role key must never reach the client bundle. No such key is present in the repo today (`.env.local.example` only has the public URL + anon key), which is correct for the current feature set but will need to be added carefully when account deletion is built.

## 5. Authorization / RLS Architecture

RLS is enabled on every table and is the actual enforcement boundary (not just middleware). Pattern used consistently:
- Direct-ownership tables (`workout_plans`, `workout_logs`, `exercises` split between global/own, `profiles`): `using (user_id = auth.uid())` / `id = auth.uid())`.
- Child tables (`planned_exercises`, `logged_exercises`, `logged_sets`, the `*_muscle_groups` join tables): access via an `exists (select 1 from <parent> where <parent>.id = ... and <parent>.user_id = auth.uid())` subquery — correctly scoped, if slightly repetitive.
- `muscle_groups`: readable by any authenticated user, not writable by users at all (no insert/update/delete policy) — appropriate for a global lookup table.

This is a solid, correct RLS pattern for the current scope and should be the template for every new table: never rely on the client or Server Action code alone to enforce ownership; always back it with RLS.

Gap: no automated tests verify RLS policies (e.g., that user A cannot read user B's `workout_logs`). This should be introduced once a testing strategy exists (see §11).

## 6. Planned vs. Actual Workout Model

Already correctly modeled (see §2/§3). Going forward:
- Do not add columns to `workout_logs`/`logged_*` that duplicate `workout_plans`/`planned_*` fields "for convenience" — always join through `plan_id` if a comparison is needed.
- Adherence/progress features (Phase 9) should be read-side computations over these two hierarchies, not a new merged table.
- If adaptive training (Phase 11) starts generating plan suggestions, those suggestions should still be written into `workout_plans`/`planned_exercises` (marked with a provenance flag, e.g. `source: 'user' | 'ai_suggested'`) rather than a separate shadow schema — keeps the planning surface single-sourced. Exact mechanism to be designed in Phase 11, not now.

## 7. Analytics Architecture (target)

None exists today beyond raw list views. When Phase 9 (Progress Intelligence) is built:
- Prefer read-time SQL views or Postgres functions over duplicating/denormalizing data into new tables, given current data volume expectations (single user, years of personal history — not big-data scale).
- Any precomputed aggregate (e.g., weekly volume) should be treated as a cache, derivable from `logged_sets`, not a new source of truth.

## 8. AI Architecture (target, Phase 13)

- The LLM is a reasoning layer over structured data pulled from Postgres at request time — it is never queried for facts about the user's history that Postgres already has.
- Reference implementation to study for patterns (not to copy wholesale): the `ai_health_fitness_agent` example in `Shubhamsaboo/awesome-llm-apps`. Gym-Journo owns its own data model; the external agent's architecture must not dictate Gym-Journo's.
- Expected shape: a server-side function that (1) gathers structured context (goal, recent plan/log adherence, recent performance, recovery if present), (2) calls an LLM with that context plus a constrained output schema, (3) stores the interaction and recommendation, (4) surfaces it to the user for accept/reject/modify.
- Needs new entities: something like `ai_conversations`/`ai_interactions` (raw interaction log) and `recommendations` (structured output, with status: pending/accepted/rejected/modified) — exact shape to be finalized in Phase 13 design, not invented now (per "don't blindly create all tables" guidance).
- No AI provider/SDK dependency exists in `package.json` yet — none should be added until Phase 13 scoping picks one deliberately.

## 9. Recommendation Architecture (target)

- Recommendations are a distinct, persisted concept from chat messages — a recommendation has structured fields (what, why, what data it used) even though the "why" text may be LLM-generated.
- User response to a recommendation (accept/override/ignore) must be recorded — this is the "Coach Decision" / "User Override" concept referenced in the product brief, needed later for measuring whether coaching is actually useful.

## 10. Privacy Architecture

- RLS-first, as established (§5). Every new table must ship with RLS enabled and an ownership policy in the same migration that creates it — no table should exist RLS-disabled even temporarily in a committed migration.
- Progress photos (Phase 8) will need Supabase **Storage**, not a Postgres table, for the binary data. Storage buckets need their own RLS-equivalent policies (Supabase Storage policies) scoped to the owning user, and should default to a private bucket with signed-URL access — never a public bucket.
- No new PII should be collected without a clear product reason tied to a roadmap phase.

## 11. Testing Strategy (target — currently absent)

Current state: **no test files, no test runner configured, no CI workflow** (`.github/` does not exist). `npm run lint` (ESLint via `eslint-config-next`) is the only automated check today.

Recommended minimal strategy, introduced incrementally rather than all at once:
1. Add CI (GitHub Actions) running `npm run lint` and `npm run build` on every push/PR — cheapest possible safety net, catches type errors and broken builds immediately. This alone is worth doing before Phase 1 implementation work begins.
2. Add unit tests for pure logic first (`src/lib/date.ts` is a good first target — no I/O, easy to test).
3. Add RLS policy tests (can be done via `pgTAP` in Supabase or via a small script using two authenticated test users hitting the anon client) once more tables exist — this is the highest-value test category given RLS is the actual security boundary.
4. Defer end-to-end/browser tests (e.g., Playwright) until the UI stabilizes past Phase 0-era churn; introduce them starting around Gym Mode (Phase 6), since that's the highest-frequency, highest-risk-of-regression user flow.

Do not introduce a testing framework choice inside this Phase 0 pass — flagged as a decision for the product owner / next implementation step (see Roadmap Phase 0 deliverables).

## 12. PWA Architecture (target)

Current state: none. `next.config.ts` has no PWA plugin; there is no `manifest.json`, `public/` only has default Next.js placeholder SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — these are unused boilerplate from `create-next-app` and should be removed when the app gets real branding/icons).

Target, minimal-first:
1. Add `public/manifest.json` + real app icons, link it from `layout.tsx`.
2. Add a service worker for static asset caching (Next.js has no built-in PWA support as of this version; a small hand-written service worker or a lightweight plugin is sufficient — avoid pulling in a heavy PWA framework for what is currently a simple shell-caching need).
3. Defer offline-write/sync — Supabase's client doesn't provide this out of the box, and building it is a substantial project on its own; not justified until there's a concrete user need for offline logging.

## 13. Environment Configuration

- `.env.local.example` documents `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — both intentionally public/anon-scoped, correct for a client-heavy app relying on RLS.
- No service-role key, no LLM API key, no other secrets configured yet — expected, since account deletion and AI features don't exist yet. Both will need to be added as server-only env vars (never `NEXT_PUBLIC_*`) when those phases begin.
- No `.env.local` is committed (correctly gitignored); no secrets found in the repository during this audit.

## 14. Dependency Notes

- `zod` is listed in `package.json` dependencies but is not imported anywhere in `src/` — either it was scaffolded for validation that was never wired in, or it's dead weight. Should be either put to use (e.g., validating Server Action inputs, which is currently done with ad-hoc manual coercion like `String(formData.get(...))` and `parseInt`) or removed. Recommendation: keep it and actually use it for Server Action input validation going forward — manual coercion is a minor but real correctness risk (e.g., silent `NaN` on bad numeric input isn't guarded anywhere).
- No other unused or concerning dependencies found. Dependency list overall is minimal and appropriate — no unnecessary additions should be made without justification, per working rules.

## 15. Deployment Assumptions

- No deployment configuration (no `vercel.json`, no Dockerfile, no CI/CD) is committed. `.gitignore` includes a `.vercel` entry, implying Vercel is the assumed target, but this hasn't been confirmed with the product owner and no project is currently linked in this checkout.
- Recommendation: confirm hosting target explicitly before Phase 15 (Production/PWA prep), and add CI before then regardless (see §11).
