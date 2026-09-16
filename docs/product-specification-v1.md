# Gym-Journo — Product Specification v1

Status: Draft for product-owner review. Reflects Phase 0 audit of the repository as of 2026-09-16.

## 1. Product Vision

Gym-Journo is a personal fitness operating system, not a workout logger. The core loop is:

**Goal → Plan → Train → Log → Analyze → Coach → Adapt → Repeat**

The product's long-term differentiator is longitudinal understanding of one individual user — what they planned, what they actually did, and the gap between the two — used to drive explainable coaching over time.

## 2. Problem Statement

Most fitness apps either (a) log sets/reps with no planning or goal context, or (b) generate generic AI plans with no memory of what the user actually did. Neither preserves the distinction between **planned** and **actual** training, which is what makes adherence analysis, fatigue tracking, and real coaching possible. Gym-Journo exists to preserve that distinction from day one and build every future feature — analytics, recommendations, AI coaching — on top of structured, queryable data rather than free text.

## 3. Product Principles

1. Structured data is the source of truth; the LLM is a reasoning layer over it, never the system of record.
2. Planned and actual workout data are always modeled separately.
3. AI recommendations must be explainable and overridable — never silently applied.
4. Privacy by default — no social features, no public profiles, no leaderboards.
5. No monetization architecture until explicitly requested.
6. Prefer the simplest architecture that supports the roadmap; do not build for hypothetical native-app or scale requirements prematurely.
7. Fast logging beats a "complete" feature set. Every added field/screen is a tax on the core loop.

## 4. Target User

An individual who trains with some regularity (2–6x/week), wants to plan sessions in advance, log what actually happened, and — eventually — get grounded, explainable suggestions instead of generic advice. Not a coach managing clients; not a social user seeking community. Single-tenant per account, private by default.

## 5. Core Product Loop

- **Goal** — user states an intent (build muscle, lose fat, etc.) that should influence every downstream recommendation.
- **Plan** — user (or eventually the AI, with approval) schedules a workout for a date: muscle groups, exercises, target sets/reps.
- **Train** — the user executes the session in the gym (future: a guided "Gym Mode").
- **Log** — the user records what actually happened: reps, weight, sets, possibly deviating from the plan.
- **Analyze** — the system surfaces trends: adherence, volume, progression, plateaus.
- **Coach** — the AI proposes changes grounded in the user's actual structured history.
- **Adapt** — the user accepts, edits, or rejects the proposal; the plan updates accordingly.
- **Repeat.**

## 6. Goal Framework

`profiles.goal` currently exists as a single free-text-ish field (populated from a fixed client-side `<select>`: Build muscle, Lose fat, Maintain, General fitness) with no history and no structured influence on any other feature — it is captured at onboarding and re-editable on `/profile`, but nothing reads it except as a string interpolated into the AI prompt.

**Decision needed (flagged in §11):** whether to keep goal as a single mutable field on `profiles` (simplest) or introduce a `goal_history` concept so goal changes over time are analyzable (e.g., "switched from cut to bulk on {date}" is itself useful coaching context). Recommendation: keep it as a single field on `profiles` for Phase 2, add history only when a concrete feature needs it (YAGNI per product philosophy) — see `docs/technical-architecture-v1.md` §4 for the reasoning.

Until a decision is made, do not expand the goal enum or wire it into more features than profile display and the AI prompt.

## 7. Functional Requirements

### 7.1 Authentication
- Email + password registration and sign-in — **present**, via Supabase Auth, but registration is implicit: there is no dedicated sign-up screen; a new user is created the first time they request a magic link or (unverified) via password sign-in against a non-existent account.
- Magic-link sign-in — **present** (`signInWithOtp`).
- Forgot password / password reset — **missing**. No `resetPasswordForEmail` flow, no reset page.
- Persistent sessions — **present** (Supabase cookie session via `@supabase/ssr`).
- Logout — **present** (`SignOutButton`).
- Protected routes — **present**, enforced in `proxy.ts` (formerly `middleware.ts`) by redirecting unauthenticated users to `/login`.
- Email verification — **unclear/likely absent**. Password sign-in and magic-link both call `signInWithOtp`/`signInWithPassword` without an explicit "confirm your email" gate visible in the app; depends on Supabase project auth settings, not app code.
- Account deletion — **missing**.

### 7.2 Onboarding
- Single-page form (`/onboarding`) collecting name, age, height, weight, sex, goal, and **forcing password creation** for magic-link-only users. This conflates "set your fitness profile" with "set a password," which is a reasonable shortcut today but should be reconsidered once forgot-password exists (see open decisions).
- Enforced via `proxy.ts` redirect until `profiles.onboarded = true`.

### 7.3 Fitness Goals
- See §6. Currently onboarding-only in practice; must become a first-class driver of planning/coaching per the product mandate — not yet true today.

### 7.4 Workout Planning
- `/schedule/[date]` — pick muscle groups, pick exercises from the shared/custom library, set target sets/reps per exercise, or mark the day a rest day. One plan per user per date (`unique(user_id, date)`).
- No recurring/template plans (e.g., "repeat this every Monday") — every date is planned individually. This is a real gap for a "planning" product.
- No AI-assisted plan creation that writes directly into `workout_plans` — the current AI feature only outputs markdown text, disconnected from the structured plan tables (see §7.10).

### 7.5 Workout Execution ("Gym Mode")
- No dedicated in-gym execution UI exists. `/log/[date]` is a form filled in (pre- or post-workout), not a set-by-set, rest-timer-driven logging experience. "Gym Mode" as described in the target journey does not exist yet.

### 7.6 Journal / History
- `/history` — reverse-chronological list of logs, filterable by exercise, capped at 60 most recent logs (no pagination).
- `/log/[date]` doubles as both the entry form and the read view for a past date.

### 7.7 Progress
- No dedicated progress/analytics screen. History gives a raw list; there is no charting, PR tracking, volume trends, or plateau detection anywhere in the app today.

### 7.8 Body / Photos
- No body-measurement tracking and no progress-photo feature exist at all. Referenced only as future concepts in the target model.

### 7.9 Recovery
- No recovery/soreness/sleep tracking exists.

### 7.10 Nutrition
- `nutrition_logs` — one free-text meal entry per user per day, used solely as AI-prompt context. No macro/calorie parsing, no structured nutrition data.

### 7.11 AI Coach
- `/ai-plan` — user fills a small form (activity level, dietary preference, notes, today's meals); a server action builds a single large prompt (profile + last-14-days training summary + next-7-days schedule summary + today's meals) and calls Gemini (`gemini-3.6-flash`) via a hand-rolled fetch wrapper (`src/lib/gemini.ts`). Output is markdown, stored verbatim in `ai_plans.plan_markdown`, rendered via `react-markdown`.
- Rate-limited to 3 generations/day/user via a count query against `ai_plans.created_at`.
- **This is explainable and grounded in real data (good — matches the product mandate) but is currently read-only output.** It does not write structured `workout_plans`/`planned_exercises`, so the user cannot "accept" an AI-recommended workout into their real schedule — they'd have to manually re-enter it. This violates the "AI recommendations should be explainable and the user can override, not silently modify" principle only in the sense that today there's nothing to accept or override — there's no bridge between AI output and structured plan data at all. This is the single biggest gap between the current AI feature and the target "coach" experience.
- No conversation/interaction history beyond the flat `ai_plans` list — no `ai_conversations` concept, no way to ask a follow-up.

### 7.12 Adaptive Training
- Not implemented. No mechanism detects plateaus, adjusts targets, or reacts to adherence patterns.

## 8. Non-Functional Requirements

- **Privacy**: RLS enforced per-table today (see technical doc); must remain the default posture for every new table.
- **Performance**: Mobile-first, must remain fast to open and log a set; current server-action-per-save pattern is fine at this scale.
- **Reliability**: AI calls must fail gracefully without corrupting logging data — currently true (Gemini failure returns an error, doesn't touch other tables) and should stay true as AI scope grows.
- **Data integrity**: Deterministic fitness data (sets/reps/weights) must never be inferred or silently rewritten by the LLM.

## 9. Information Architecture / Navigation

Bottom tab bar (`BottomNav.tsx`): Today, Calendar, History, Exercises, Profile. `/ai-plan`, `/schedule/[date]`, `/log/[date]`, `/onboarding`, `/login` are reached via links, not tabs. This is a reasonable IA for the current feature set; will need revisiting once Progress/Coach become primary destinations rather than a single "AI Plan" link from Today.

## 10. Screen Inventory (current)

`/login`, `/auth/callback`, `/onboarding`, `/` (Today), `/calendar`, `/schedule/[date]`, `/log/[date]`, `/history`, `/exercises`, `/profile`, `/ai-plan`.

## 11. Explicit Out-of-Scope (per AGENTS.md mandate)

- Social feeds, followers, public profiles, leaderboards.
- Monetization / paid feature gating.
- Native mobile apps (architecture must not be shaped around them prematurely).
- Generic chatbot AI experience disconnected from structured user data.

## 12. Phase Roadmap

See `docs/roadmap-v1.md`.

## 13. Definition of Done (per phase, general standard)

- Feature works end-to-end for an authenticated user with RLS enforced (no cross-user data leakage, verified manually or via test).
- No regression in existing flows (auth, planning, logging, history).
- New tables have RLS enabled with an explicit policy before merge.
- No secrets committed; `.env.local.example` kept in sync with required variables.
- Docs (`docs/technical-architecture-v1.md`, this file) updated if the change alters the data model, IA, or product loop.

## 14. Important Unresolved Decisions

See report section F in the audit summary delivered alongside this document — duplicated here for durability:

1. **Goal model**: single mutable field vs. goal history table (§6).
2. **Onboarding/password coupling**: should password-setting be split out of onboarding once forgot-password exists?
3. **AI plan → structured plan bridge**: should AI-generated workouts become directly acceptable into `workout_plans`/`planned_exercises`, and if so, what does "override" look like in the UI?
4. **next.config.ts bug** (see technical doc §9): the `module.exports` block appended after `export default nextConfig` is dead/conflicting config and needs a decision on which config style to keep — blocks correctly wiring `allowedDevOrigins`.
5. **Email verification** posture: rely on Supabase project settings only, or add an explicit in-app "verify your email" gate?
