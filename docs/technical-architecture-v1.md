# Gym-Journo — Technical Architecture v1

Status: Draft for product-owner review. Reflects Phase 0 audit of the repository as of 2026-09-16.

## 1. Application Architecture

- **Framework**: Next.js 16.3.5 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4.
- **Next.js 16 note**: this project has already begun the `middleware.ts` → `proxy.ts` migration required by Next 16 (`src/middleware.ts` deleted, `src/proxy.ts` added, uncommitted). Confirmed against `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`: the `middleware` filename/export is deprecated in favor of `proxy`, edge runtime is not supported in `proxy`. This repo's `proxy.ts` correctly exports `proxy` (not `middleware`) with the same matcher config — the rename is done correctly, just not yet committed.
- **Rendering model**: Server Components for all data reads (`src/lib/queries.ts` functions called directly from page components); mutations go through Server Actions (`"use server"` files colocated per route, e.g. `src/app/schedule/[date]/actions.ts`). Interactive forms are thin client components (`"use client"`) that call the server actions via `useTransition`.
- **No API routes** except `/auth/callback` (OAuth/magic-link code exchange). All other data access is server-action-based — appropriate for this app's scale, avoids a redundant REST/GraphQL layer.
- **No global client state library** (no Redux/Zustand/Context for app data) — each page fetches its own data server-side and re-fetches via `router.refresh()` after a mutation. Appropriate for the current scope.
- **Styling**: Tailwind utility classes inline, dark theme hardcoded (`bg-neutral-950`), no theme switching.
- **PWA**: **absent**. No manifest.json, no service worker, no `next-pwa`/Workbox config, no install-prompt handling. `viewport` metadata in `layout.tsx` sets `themeColor` but that alone does not make this a PWA.
- **Testing**: **absent**. No test runner configured (no Jest/Vitest/Playwright in `package.json`), no test files anywhere in the tree.
- **Linting**: ESLint 9 + `eslint-config-next`, present and standard.

## 2. Route Map

| Route | Type | Auth-gated | Purpose |
|---|---|---|---|
| `/login` | page + actions | public | password + magic-link sign-in |
| `/auth/callback` | route handler | public | exchanges magic-link code for session |
| `/onboarding` | page + actions | authenticated, pre-onboarded | collects profile + forces password set |
| `/` | page | authenticated | "Today" — plan/log status for today, AI-plan entry point |
| `/calendar` | page | authenticated | week view of plans/logs |
| `/schedule/[date]` | page + actions | authenticated | create/edit a day's plan |
| `/log/[date]` | page + actions | authenticated | record actual sets |
| `/history` | page | authenticated | past logs, filterable by exercise |
| `/exercises` | page + actions | authenticated | shared + custom exercise library |
| `/profile` | page + actions | authenticated | edit profile fields / password |
| `/ai-plan` | page + actions | authenticated | Gemini-generated diet/workout markdown |

Gating logic lives entirely in `src/proxy.ts` → `src/lib/supabase/middleware.ts`: unauthenticated users are redirected to `/login`; authenticated-but-not-onboarded users are redirected to `/onboarding` for every route except `/login*`, `/auth*`, `/onboarding*`.

## 3. Authentication Architecture

- Supabase Auth via `@supabase/ssr`, three client constructors:
  - `src/lib/supabase/client.ts` — browser client (anon key).
  - `src/lib/supabase/server.ts` — server client for Server Components/Actions, cookie read/write against `next/headers`.
  - `src/lib/supabase/middleware.ts` — request-scoped client used inside `proxy.ts` to refresh the session cookie and perform the redirect checks above.
- Sign-in methods: `signInWithPassword` and `signInWithOtp` (magic link, `shouldCreateUser: true` — this is also the de facto registration path for magic-link users). No explicit "Sign up" form; a user who has never signed in appears first via magic link, or an admin/seed process would need to create them for password sign-in to work immediately.
- Password reset: not implemented (`supabase.auth.resetPasswordForEmail` unused anywhere).
- Session persistence: cookie-based, refreshed on every request by `proxy.ts`.
- Onboarding forces `supabase.auth.updateUser({ password })`, meaning a magic-link user's account effectively gains a password only after completing onboarding — reasonable UX shortcut but couples identity setup to profile setup (flagged in product spec).

## 4. Database Architecture

Supabase/Postgres, five migrations applied in order (`0001`–`0005`), all additive (no destructive/breaking migrations so far — good hygiene to preserve).

### Core tables (from `0001_init.sql`, `0002`, `0003`)

- `muscle_groups` — global lookup, seeded, not user-editable.
- `exercises` — shared (`user_id is null`) or user-owned; `exercise_muscle_groups` join table.
- `workout_plans` — **one row per user per date** (`unique(user_id, date)`), with `is_rest_day` (added in `0002`). This is the "planned" side.
- `workout_plan_muscle_groups`, `planned_exercises` — plan detail, cascade-deleted with the plan.
- `workout_logs` — **one row per user per date** (`unique(user_id, date)`), optional `plan_id` FK back to the plan it was logged against (`on delete set null`, so a log survives its plan being deleted). This is the "actual" side.
- `logged_exercises`, `logged_sets` — log detail, cascade-deleted with the log.
- `profiles` — one row per user (`id` = `auth.users.id`), holds fitness-goal + onboarding flag + basic stats.

### Later additions (`0004`, `0005`)

- `ai_plans` — stores generated markdown plans; also doubles as the rate-limit ledger (counted by `created_at` in the last 24h). Reusing a content table as a rate-limit log is a minor debt: fine at current volume, but if `ai_plans` rows are ever deleted/archived the rate limit silently resets. Flag for later, not urgent.
- `nutrition_logs` — one free-text row per user per date, feeds the AI prompt only.

### Planned vs. actual — assessment

The schema already correctly separates **planned** (`workout_plans`/`planned_exercises`) from **actual** (`workout_logs`/`logged_exercises`/`logged_sets`), with `workout_logs.plan_id` as the only link between them. This is the single most important architectural decision in the product mandate, and it's already done correctly — **keep this design**, extend it, don't replace it.

### Missing entities (per product mandate's candidate list)

Evaluated against actual current needs, not the full candidate list blindly:

- `goal_history` — **not yet needed**; `profiles.goal` is a single field today with no consumer that needs history. Revisit only when a feature (e.g. "show goal changes on progress timeline") requires it.
- `exercise_variant` — **not yet needed**; `exercises` already supports user-owned custom exercises, which covers "variant" use cases informally (e.g., a user adds "Close-Grip Bench Press" as its own row). A true variant/parent relationship should wait for a concrete need (e.g. rolling up variants for progression charts).
- `body_measurement`, `progress_photo` — **missing, needed** for Phase 8 (Body & Transformation) — straightforward additive tables, each `user_id`-scoped with RLS, no dependency on anything else.
- `recovery_entry` — **missing, needed** for Phase 10 — same shape.
- `recommendation`, `coach_decision`, `user_override` — **missing, needed** before Phase 13 (AI Coach) can honor "explainable + overridable" for anything beyond markdown text. This is the key structural gap: today `ai_plans` stores an opaque markdown blob with no structured link to what it recommended or whether the user acted on it. Before building real coaching, introduce a `recommendations` table with typed fields (e.g. proposed changes to specific `planned_exercises` rows) so a recommendation can be diffed, explained, accepted, or overridden — rather than parsing markdown.
- `ai_conversation`/`ai_interaction` — **defer**; `ai_plans` is adequate as an interaction log until multi-turn conversation is actually built.

## 5. Authorization / RLS

RLS is enabled on every user-data table across all five migrations — consistent and correct pattern:
- Simple `user_id = auth.uid()` policies on directly-owned tables (`workout_plans`, `workout_logs`, `profiles`, `ai_plans`, `nutrition_logs`).
- `exists (...)` ownership-chain policies for child tables (`logged_sets` checks through `logged_exercises` → `workout_logs`; `planned_exercises` checks through `workout_plans`).
- `exercises` correctly allows read of both global (`user_id is null`) and own rows, write restricted to own.
- `muscle_groups` is read-only for any authenticated user, matching its role as a shared lookup table.

No policy gaps were found in the migrations read. This pattern should be the template for every new table — RLS enabled in the same migration that creates the table, never added later.

## 6. Analytics Architecture

Does not exist yet beyond the raw `/history` list and the text summarization used for the AI prompt (`getRecentTrainingSummary`, `getUpcomingScheduleSummary` in `src/lib/queries.ts`). No aggregation tables, no materialized views, no charting. Given the roadmap places real "Progress Intelligence" at Phase 9, this is expected to be missing now — not a defect, just unbuilt.

## 7. AI Architecture

- `src/lib/gemini.ts` — a minimal, dependency-free `fetch` wrapper around the Gemini `generateContent` REST endpoint (model `gemini-3.6-flash`), no SDK, no streaming, no retry logic, single-turn only.
- `src/app/ai-plan/actions.ts` — the actual "reasoning layer": pulls profile + 14-day training summary + 7-day schedule summary + today's meals from Postgres, assembles one large prompt (`buildPrompt`), calls Gemini, stores the raw markdown response.
- This matches the mandate's intent ("LLM operates as a reasoning layer over structured Gym-Journo data") for the *read* side — the prompt is genuinely grounded in real structured data, not generic. It does **not** yet satisfy the mandate on the *write* side: there's no path for an AI recommendation to become a structured, overridable change to `workout_plans`. See product spec §7.11 and the `recommendation`/`user_override` schema gap above — this is the main architectural work needed before "AI Coach" (Phase 13) can be more than a markdown viewer.
- `GEMINI_API_KEY` is read from `process.env` but is **not documented** in `.env.local.example` — should be added so setup instructions stay accurate.

## 8. Recommendation Architecture

Not implemented. Depends on the `recommendation`/`coach_decision`/`user_override` schema work above; out of scope until Phase 13/11.

## 9. Privacy Architecture

- No feature reads or writes another user's data anywhere audited — every query filters by `auth.uid()` at the query layer *and* RLS enforces it at the database layer (defense in depth, correctly done).
- No social/sharing surface exists, consistent with the "private by default" mandate.
- Progress photos don't exist yet, so "private by default" for them is a Phase 8 design requirement to carry forward, not a current gap.

## 10. PWA Architecture

Not implemented (see §1). A future PWA pass needs: `manifest.json`, icons, a service worker (via `next-pwa`, Serwist, or hand-rolled), and offline/cache strategy for the logging flow specifically (workout logging should ideally work with a flaky gym-basement connection — this is a real product argument for PWA investment, not just a checkbox).

## 11. Testing Strategy

None exists today. Recommended minimum before Phase 1 implementation work grows further: RLS policy tests (verify cross-user isolation, ideally via a script against a local Supabase instance) and server-action unit tests for the save/upsert logic in `schedule/actions.ts` and `log/actions.ts`, since those contain the delete-then-reinsert pattern that's easy to regress silently.

## 12. Known Technical Debt (concrete, found during audit)

1. **`next.config.ts` is broken**: it does `export default nextConfig` (empty object) *and then* appends `module.exports = { allowedDevOrigins: [...] }`. In a TypeScript ESM config file, the `module.exports` assignment is very likely dead code / a conflicting second export target — `allowedDevOrigins` is probably not actually taking effect. Needs a decision (flagged in product spec §14) and a one-line fix once decided.
2. **`src/middleware.ts` deletion / `src/proxy.ts` addition is uncommitted** — correct per Next 16 docs, but should be committed as its own small, reviewable commit rather than left as working-tree drift, per the "small reviewable commits" working rule.
3. **`GEMINI_API_KEY` undocumented** in `.env.local.example`.
4. **`ai_plans` doubles as rate-limit ledger** (§4) — minor, documented for future awareness.
5. **No pagination** on `/history` (hard 60-row cap) — fine at current usage, will need real pagination once users accumulate more history.
6. **Registration is implicit** via magic-link `shouldCreateUser: true` — works, but there's no explicit "create account" UX distinct from "sign in," which will read as a gap once forgot-password and account-deletion are added and the app has more than one identity flow to reason about together.

## 13. Deployment Assumptions

No deployment config found in-repo (no `vercel.json`, no Dockerfile, no CI workflow directory found under `.github/`). Presumed target is Vercel given the Next.js/Supabase stack, but this is an assumption, not confirmed — flag for product-owner confirmation if a specific deployment target matters for Phase 15 planning.
