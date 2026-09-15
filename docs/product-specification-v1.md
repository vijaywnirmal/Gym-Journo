# Gym-Journo — Product Specification v1

Status: Draft for product-owner review (Phase 0 output). Not yet approved.

## 1. Product Vision

Gym-Journo is a personal fitness operating system built around one loop:

**Goal → Plan → Train → Log → Analyze → Coach → Adapt → Repeat**

The product's long-term differentiator is longitudinal understanding of a single user — what they planned, what they actually did, and how that changes over time — used to power explainable, user-controlled coaching. It is not a workout logger, not a social fitness app, and not a generic AI chat wrapper.

## 2. Problem Statement

Most fitness apps either:
- Log workouts but don't connect logs back to a goal or a plan, or
- Generate plans but don't track adherence against them, or
- Bolt on a chatbot that gives generic advice disconnected from the user's actual data.

Nobody preserves the **planned vs. actual** distinction as a first-class, queryable concept and uses it to drive recommendations. That gap is Gym-Journo's opportunity.

## 3. Product Principles

1. Logging must be extremely fast — it's the highest-frequency action in the product.
2. Planned data and actual data are always kept separate and both preserved.
3. The fitness goal is a first-class, structured concept — not onboarding trivia.
4. AI recommendations are explainable and generated from structured data, never from vibes.
5. The user can always override AI/plan suggestions; the system never silently rewrites the user's plan.
6. Privacy by default — this is a personal tool, not a social network.
7. No feature creep — build what serves the core loop, not what a competitor has.
8. Simplicity first — the simplest architecture that supports the roadmap, not the most impressive one.

## 4. Target User

An individual training with intent (not necessarily an athlete) who:
- Wants to plan workouts ahead of time and follow through in the gym.
- Wants an accurate, low-friction record of what they actually lifted.
- Wants to understand progress over weeks/months, not just see a single day's numbers.
- Eventually wants coaching that reasons over their own history rather than generic advice.

Out of scope for v1: coaches/trainers managing multiple clients, teams/gyms, social/competitive users.

## 5. Core Product Loop

```
Goal → Plan → Train → Log → Analyze → Coach → Adapt → Repeat
```

- **Goal**: user declares what they're training for (e.g., build muscle, lose fat).
- **Plan**: user (or eventually the system) lays out a workout plan for a day.
- **Train**: user executes the workout in the gym (Gym Mode).
- **Log**: user records what actually happened, distinct from the plan.
- **Analyze**: system surfaces progress, adherence, and trends from structured data.
- **Coach**: system explains what it sees and recommends next steps.
- **Adapt**: plan changes based on coaching, with user approval.
- **Repeat**: loop continues, and history compounds in value over time.

Today's app implements Plan → Train (partially) → Log → (light) Analyze. Goal exists as a static profile field with no downstream effect. Coach and Adapt do not exist yet.

## 6. Goal Framework

The fitness goal is a structured, first-class entity, not a free-text/onboarding-only field.

v1 goal model (subject to Phase 2 design, see technical-architecture-v1.md):
- A user has exactly one **active goal** at a time, chosen from a constrained set (Build muscle, Lose fat, Gain strength, Body recomposition, General fitness, Maintain fitness).
- Goal changes are recorded with a timestamp so goal history is queryable (needed later for adherence/coaching context — "the user has been on 'build muscle' for 10 weeks").
- The goal is attached to the user profile today (`profiles.goal`) but is not read anywhere except for display. This must change so planning, analysis, and future AI coaching can condition on it.

This is intentionally minimal for v1 — no goal-specific targets (e.g. calorie targets, strength targets) are modeled yet. That's deferred until nutrition/AI phases need it.

## 7. Functional Requirements

### 7.1 Authentication
- Email + password registration
- Email + password sign-in
- Magic-link sign-in
- Forgot password / password reset
- Persistent sessions
- Logout
- Protected routes (redirect unauthenticated users to sign-in)
- Email verification where appropriate
- Account deletion

Current state: password sign-in and magic-link sign-in exist. Registration is implicit (magic link auto-creates a user; password accounts are created via onboarding after a magic-link session exists). No explicit "sign up" flow, no forgot-password/reset flow, no email verification gating, no account deletion. See gap list in section on Authentication Requirements below.

### 7.2 Onboarding
- Collects name, age, height, weight, sex (optional), goal, and sets a password.
- Gates the rest of the app until `profiles.onboarded = true` (enforced in middleware).
- Must evolve to treat goal selection as a distinct, guided step rather than one dropdown among many profile fields.

### 7.3 Workout Planning
- Plan a single day: mark as workout or rest/absence day, select muscle groups, select exercises, set target sets/reps per exercise.
- One plan per user per calendar date.
- Must remain structurally separable from actual logs (already true today via separate tables).

### 7.4 Workout Execution ("Gym Mode")
- Does not exist today. Logging currently happens as a single form filled out (from anywhere, not necessarily the gym) after or during a session — not an in-gym, set-by-set, rest-timer-aware experience.
- Future Gym Mode should optimize for one-handed, fast, in-gym entry: log a set in as few taps as possible, prefill weight/reps from the last time the exercise was performed, track rest between sets.

### 7.5 Journal / History
- Chronological list of past logs, filterable by exercise.
- Each entry shows sets/reps/weight actually performed.
- Missing: filtering by date range, by muscle group, by goal period; no pagination (hard-coded 60-row limit).

### 7.6 Progress
- Does not exist today beyond raw history list. No charts, no PR tracking, no volume/trend calculations.

### 7.7 Body / Progress Photos
- Does not exist today. Profile stores height/weight snapshot only, with no history — updating weight overwrites the previous value with no trend.

### 7.8 Recovery
- Does not exist today. No sleep, soreness, RPE, or readiness tracking.

### 7.9 Nutrition
- Does not exist today.

### 7.10 AI Coach
- Does not exist today. No AI interaction, no recommendation, no stored coaching context.

### 7.11 Adaptive Training
- Does not exist today. Plans do not change themselves; there is no adherence or plateau detection.

## 8. Non-Functional Requirements

- **Performance**: logging a set should be near-instant; avoid full-page reloads for common actions (already achieved via server actions + `router.refresh()`, acceptable for v1 scale).
- **Availability**: single-region Supabase is acceptable for v1; no multi-region requirement.
- **Data integrity**: planned and actual data must never be conflated in storage or in the UI.
- **Privacy**: all fitness data, profile data, and (future) photos are private to the owning user by default; enforced via Postgres RLS, not only application logic.
- **Accessibility**: form inputs must remain usable with a keyboard and screen reader (not audited yet — flagged as future work, not urgent for personal-use v1).
- **PWA**: installable, works offline for read paths where feasible (not implemented yet — see PWA Requirements).

## 9. Information Architecture & Navigation

Current IA (bottom tab bar, 5 tabs): Today, Calendar, History, Exercises, Profile.

Target IA (see Roadmap for phasing) keeps the same shape but adds:
- Onboarding as a distinct pre-Home flow (exists).
- Gym Mode as a full-screen, distraction-reduced execution view reachable from Today/Calendar (new).
- Progress as a new tab or a section within History (new, Phase 9).
- Coach as a new tab or panel (new, Phase 13).

Avoid growing the tab bar past 5 items; fold Progress/Coach into existing tabs or a "More" pattern if the count would otherwise exceed that.

## 10. Screen Inventory (current)

| Screen | Route | Status |
|---|---|---|
| Login | `/login` | KEEP (extend) |
| Auth callback | `/auth/callback` | KEEP |
| Onboarding | `/onboarding` | REFACTOR |
| Today (home) | `/` | REFACTOR |
| Calendar | `/calendar` | KEEP (extend) |
| Schedule a day | `/schedule/[date]` | KEEP (extend) |
| Log a day | `/log/[date]` | REFACTOR (toward Gym Mode) |
| History | `/history` | REFACTOR (add filters, pagination) |
| Exercises | `/exercises` | KEEP (extend) |
| Profile | `/profile` | REFACTOR (goal becomes first-class) |

## 11. Authentication Requirements (target)

- Explicit sign-up (email + password) distinct from magic-link-implied account creation.
- Forgot-password flow (`/login/forgot`, reset email, `/login/reset` with token).
- Email verification: require verified email before granting full write access, or at minimum communicate unverified state.
- Account deletion (self-service, cascades via existing `on delete cascade` FKs — schema already supports this at the DB level; needs a UI + confirmation flow + Supabase Auth user deletion, which requires a server-side admin call, not the anon client).
- Session handling stays as-is (Supabase SSR cookie-based sessions via middleware) — this part is solid and should be kept.

## 12. Onboarding Requirements (target)

- Keep: password creation + basic profile capture in one guided flow.
- Change: separate "fitness goal" into its own explicit step with explanation of why it matters (sets expectation that it will drive future planning/coaching).
- Defer: detailed intake (training experience, equipment access, days/week availability) until Phase 2 design decides how much is needed to make planning useful, per "avoid feature creep."

## 13. Workout Planning Requirements (target)

- Keep current model (day → muscle groups → exercises → target sets/reps).
- Add: ability to plan more than one day at once (e.g., a weekly template), deferred to a later phase — not v1.
- Add: distinguish "planned" fields from any future AI-suggested planned values so the user always sees what they authored vs. what was suggested.

## 14. Workout Execution Requirements (Gym Mode, target)

- One exercise/one set in focus at a time, large touch targets, minimal typing (steppers instead of raw number entry where practical).
- Prefill from the most recent logged performance of that exercise.
- Optional rest timer between sets.
- Must still write to the same `logged_sets`/`logged_exercises`/`workout_logs` structure — this is a UX layer change, not a data model change.

## 15. Journal/History Requirements (target)

- Filter by exercise (exists), date range (new), muscle group (new).
- Pagination or infinite scroll instead of a hard 60-row cap.

## 16. Progress Requirements (target, Phase 9)

- Per-exercise progress (e.g., top set weight over time, estimated 1RM trend).
- Volume trends per muscle group per week.
- Adherence: planned vs. actually completed sessions over a period.

## 17. Body/Photo Requirements (target, Phase 8)

- Body measurement history (weight, and optionally other measurements) as a time series, not a single overwritten value.
- Progress photos, private by default, stored in a private Supabase Storage bucket with RLS-equivalent access control (signed URLs, owner-only).

## 18. Recovery Requirements (target, Phase 10)

- Lightweight recovery signal capture (e.g., sleep, soreness, subjective readiness) tied to a date, feeding future adaptive training and AI coach context. Exact fields to be defined in Phase 10, not now — avoid speculative schema today.

## 19. Nutrition Requirements (target, Phase 12)

- Deferred entirely. No schema, no UI, until Phase 12. Do not let AI-coach work in Phase 13 assume nutrition data exists.

## 20. AI Coach Requirements (target, Phase 13)

- Coach-like, explainable, user-controlled (per product brief).
- Reads structured Gym-Journo data (goal, plan adherence, logged performance, recovery if present) — never becomes the source of truth for that data.
- Every recommendation must state what data it used and why.
- User must be able to accept, modify, or reject a recommendation; rejection/acceptance should itself be recorded (feeds "Coach Decision" / "User Override" concepts in the data model).
- Not a general chatbot — no open-ended chit-chat surface as the primary interface.

## 21. Adaptive Training Requirements (target, Phase 11)

- System-suggested adjustments to the plan (e.g., deload after missed sessions, progression after consistent completion) must be presented as suggestions requiring explicit user acceptance — never silently applied.

## 22. Privacy/Security Requirements

- RLS enabled and scoped to `auth.uid()` ownership on every user-data table (already the pattern; must be preserved and extended to every new table).
- Progress photos and body data private by default, no sharing mechanism in v1.
- No public profiles, followers, feeds, or leaderboards, ever, unless explicitly requested later.
- Service-role/admin operations (e.g., account deletion via Supabase Admin API) must run server-side only, never exposed to the client.

## 23. PWA Requirements (target)

Currently: no `manifest.json`, no service worker, no offline support, no install prompt — this is a plain responsive web app today, not yet a PWA. Target:
- Web app manifest with icons, name, theme color (a `themeColor` is already set in `layout.tsx`, but no manifest exists).
- Service worker for basic offline shell + asset caching.
- Installable on mobile home screens.
- Defer full offline-write support (e.g., offline logging with sync) unless explicitly prioritized — non-trivial with Supabase's current usage pattern.

## 24. Future Native-App Considerations

- Do not optimize current architecture for native apps prematurely (per product brief).
- Keeping business logic in server actions / a thin data layer (rather than scattered client-side) will make a future native client's API needs easier to extract later, but this is a natural consequence of good structure, not a native-specific investment.

## 25. Explicit Out-of-Scope Features (v1 and near-term)

- Social feeds, followers, public profiles, leaderboards.
- Multi-user/trainer/team accounts.
- Monetization, paid tiers, feature gating.
- Generic AI chatbot as the primary AI surface.
- Native mobile apps.
- Wearable/device integrations.

## 26. Phase Roadmap

See `docs/roadmap-v1.md` for the full phase-by-phase breakdown (Phase 0–15).

## 27. Definition of Done (product-level, applies per phase unless overridden)

A phase is done when:
1. Its scoped functional requirements are implemented and match this spec (or an approved amendment).
2. RLS/privacy requirements for any new tables are in place and verified.
3. The existing user journey is not broken (manually verified in a browser for UI-facing phases).
4. Documentation (this spec, technical architecture, roadmap) is updated if the phase changed assumptions.
5. Changes are committed in small, reviewable increments per working rules.
