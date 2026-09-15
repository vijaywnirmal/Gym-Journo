# Gym-Journo — Roadmap v1

Status: Draft for product-owner review (Phase 0 output). Not yet approved. Phases are sequential but each should be scoped/approved individually before implementation begins — this document is the map, not a commitment to build everything as specified.

---

## Phase 0 — Product & Technical Foundation
**Objective**: Establish a reliable, honest baseline understanding of the existing app before changing anything.
**Scope**: Repository audit; no code changes.
**Deliverables**: This roadmap, `docs/product-specification-v1.md`, `docs/technical-architecture-v1.md`.
**Acceptance criteria**: All three docs exist, accurately describe the current repo (verified against actual source, not assumptions), and list explicit open decisions.
**Definition of Done**: Product owner has read and either approved or annotated these docs with decisions.
**Dependencies**: None.

---

## Phase 1 — Identity & Account
**Objective**: Close the authentication gaps identified in Phase 0 so the account lifecycle is complete and correct.
**Scope**: Explicit sign-up flow, forgot-password/reset flow, email verification handling, account deletion (server-side, using service role). Keep existing password + magic-link sign-in and middleware-based route protection.
**Deliverables**: New auth screens/actions; account-deletion Server Action using a server-only service-role client; updated middleware if new public routes are needed (e.g. `/login/reset`).
**Acceptance criteria**: A new user can register explicitly, reset a forgotten password, and delete their account (with confirmation) and have all owned rows cascade-deleted per existing FK constraints.
**Definition of Done**: Manually verified end-to-end in a browser for all listed flows; RLS unaffected; no service-role key reachable from client bundle.
**Dependencies**: Phase 0 sign-off.

---

## Phase 2 — Onboarding & Goals
**Objective**: Make the fitness goal a real, structured, first-class concept instead of a display-only profile field.
**Scope**: Design the goal data model (single active goal + goal history, per product spec §6); separate the goal-selection step from the rest of onboarding; make `profiles.goal` (or its replacement) actually consumed by at least one downstream feature (even if minimally, e.g. shown contextually on Today).
**Deliverables**: Migration for goal history if the model requires a separate table (to be decided during this phase, not pre-built now); updated onboarding UI; updated profile UI.
**Acceptance criteria**: Changing a goal is recorded with a timestamp and old goals remain queryable; onboarding clearly frames the goal as consequential, not incidental.
**Definition of Done**: Goal model documented in an updated technical-architecture doc; at least one real consumer of the goal exists.
**Dependencies**: Phase 1 not strictly required but recommended first (keeps account lifecycle stable before iterating on onboarding).

---

## Phase 3 — Home / Dashboard
**Objective**: Evolve "Today" from a single-day view into a real dashboard reflecting goal + plan + recent trend at a glance.
**Scope**: Incorporate goal context (from Phase 2) and a minimal adherence/streak signal into the existing Today page; no new data model beyond what Phase 2/9 provide.
**Deliverables**: Updated `/` page.
**Acceptance criteria**: Today page shows the user's active goal and at least one piece of context beyond "what's scheduled today" (e.g., last workout summary).
**Definition of Done**: Manually verified; no regression to existing schedule/log links.
**Dependencies**: Phase 2.

---

## Phase 4 — Exercise System
**Objective**: Harden the exercise library for correctness and future extensibility (variants, better search).
**Scope**: Review current exercises feature for REFACTOR items (e.g., search/filter by name, not just muscle-group grouping; consider "exercise variants" only if a concrete need emerges — do not build speculatively).
**Deliverables**: Improved `/exercises` UX (search); decision documented on whether "Exercise Variant" is needed yet (default: not yet, per anti-speculation principle).
**Acceptance criteria**: Users can find an exercise quickly as the library grows past the current ~33 seeded entries.
**Definition of Done**: Manually verified; existing RLS/ownership model unchanged.
**Dependencies**: None beyond Phase 0.

---

## Phase 5 — Workout Planning
**Objective**: Strengthen planning without expanding scope prematurely.
**Scope**: Keep current single-day planning model. Add validation (e.g., via `zod`, currently an unused dependency) on Server Action inputs. Explicitly defer weekly-template planning unless product owner prioritizes it.
**Deliverables**: Input validation on `savePlan`/`deletePlan`; no schema changes expected.
**Acceptance criteria**: Malformed input (bad dates, negative sets/reps) is rejected with a clear error instead of silently coercing to `NaN`/nonsense values.
**Definition of Done**: Manually verified with adversarial input; existing planning UX unchanged for valid input.
**Dependencies**: None beyond Phase 0.

---

## Phase 6 — Gym Mode
**Objective**: Build a dedicated in-gym logging experience, distinct from the current generic log form.
**Scope**: New UI flow optimized for one-handed, low-friction, set-by-set entry; prefill from most recent performance of each exercise; optional rest timer. Writes to the existing `workout_logs`/`logged_exercises`/`logged_sets` tables — no schema change required.
**Deliverables**: New Gym Mode screen(s), reachable from Today/Calendar; existing `/log/[date]` may become the "review/edit" view rather than the primary entry point.
**Acceptance criteria**: A full workout (multiple exercises, multiple sets each) can be logged from Gym Mode end-to-end and matches what History/Calendar later display.
**Definition of Done**: Manually tested on a mobile viewport (this is the primary use context); introduces the first Playwright/browser test per the testing strategy in technical-architecture-v1.md §11.
**Dependencies**: Phase 5.

---

## Phase 7 — Journal & History
**Objective**: Make History scale past the current hard-coded 60-row limit and single exercise filter.
**Scope**: Add date-range and muscle-group filters; replace the fixed limit with pagination/infinite scroll.
**Deliverables**: Updated `/history` page and `getLogHistory` query.
**Acceptance criteria**: A user with >60 logged days can still browse their full history.
**Definition of Done**: Manually verified with seeded test data exceeding the old limit.
**Dependencies**: Phase 6 (shares data with Gym Mode output).

---

## Phase 8 — Body & Transformation
**Objective**: Track body measurements over time (not just a single overwritten snapshot) and support private progress photos.
**Scope**: New `body_measurements`-style time-series table (exact columns to be finalized in this phase, not now); Supabase Storage bucket for progress photos, private by default, owner-only access.
**Deliverables**: Migration(s), storage bucket + policies, minimal UI to log a measurement/upload a photo and view history.
**Acceptance criteria**: Weight history is queryable as a trend, not a single value; photos are confirmed inaccessible to any user other than the owner (verified with a second test account).
**Definition of Done**: RLS/storage-policy verification documented; manually tested cross-account isolation.
**Dependencies**: Phase 1 (account model stable).

---

## Phase 9 — Progress Intelligence
**Objective**: Turn structured plan/log/body data into meaningful trends.
**Scope**: Per-exercise progress (top-set trend, est. 1RM), per-muscle-group weekly volume, planned-vs-actual adherence over a period. Read-side computation (views/functions) over existing tables per technical-architecture-v1.md §7 — avoid new source-of-truth tables.
**Deliverables**: New Progress views/screens; SQL views or functions as needed.
**Acceptance criteria**: A user with several weeks of logged data can see at least one real trend chart and one adherence metric.
**Definition of Done**: Manually verified against known seeded data (numbers should be independently checkable by hand for a small dataset).
**Dependencies**: Phases 6–8 (needs real logged and body data to be meaningful).

---

## Phase 10 — Recovery
**Objective**: Capture minimal recovery signals to later inform adaptive training and AI coaching.
**Scope**: Define the minimal viable recovery fields in this phase (not pre-decided now, per anti-speculation principle) — likely candidates: sleep, soreness, subjective readiness, tied to a date.
**Deliverables**: New table + RLS, minimal daily capture UI.
**Acceptance criteria**: Recovery entries are queryable by date and usable as future AI context.
**Definition of Done**: Manually verified; no dependency on AI features existing yet.
**Dependencies**: Phase 2 (goal context helps frame why recovery matters to the user).

---

## Phase 11 — Adaptive Training
**Objective**: Use adherence + progress + recovery data to suggest plan adjustments — always as suggestions, never silent changes.
**Scope**: Rule-based (not necessarily AI-based) first pass — e.g., suggest a deload after N missed sessions, or a progression after consistent completion. Suggestions land as proposed edits to `workout_plans`/`planned_exercises` that the user must explicitly accept.
**Deliverables**: Suggestion-generation logic (can be a scheduled job or on-demand check), an accept/reject UI on suggestions, provenance marking on plan data (e.g., `source: 'user' | 'suggested'`).
**Acceptance criteria**: A suggestion never modifies `workout_plans` without a recorded user acceptance action.
**Definition of Done**: Manually verified that rejecting a suggestion leaves the existing plan untouched.
**Dependencies**: Phases 9–10.

---

## Phase 12 — Nutrition
**Objective**: Add nutrition tracking/recommendations aligned to the active goal.
**Scope**: To be scoped in detail at the start of this phase — deliberately not designed now, per "avoid feature creep" and "don't blindly create tables" guidance. Minimum candidate: basic intake logging tied to goal-relevant targets.
**Deliverables**: TBD at phase kickoff.
**Acceptance criteria**: TBD at phase kickoff.
**Definition of Done**: TBD at phase kickoff.
**Dependencies**: Phase 2 (goal model must exist and be meaningful first).

---

## Phase 13 — AI Coach
**Objective**: Deliver the coach-like, explainable, user-controlled AI experience described in the product brief.
**Scope**: Server-side context-gathering (goal, adherence, progress, recovery) → LLM call with constrained output → persisted recommendation → user accept/reject/modify UI. New entities for AI interaction history and recommendations (exact shape finalized in this phase). Reference `awesome-llm-apps/.../ai_health_fitness_agent` for prompting/agent patterns only — Gym-Journo's data model and architecture remain authoritative.
**Deliverables**: AI context-assembly function, recommendation storage, chosen LLM provider/SDK integration (not yet selected), UI for viewing/responding to recommendations.
**Acceptance criteria**: Every recommendation shown to the user states what data informed it; every accept/reject is recorded; no recommendation silently modifies a plan.
**Definition of Done**: Manually verified with a real account containing several weeks of Phase 6–10 data; explanation text is checked for actually citing real user data, not generic advice.
**Dependencies**: Phases 2, 9, 10, 11 (needs goal, progress, recovery, and the suggestion/acceptance pattern already established by adaptive training).

---

## Phase 14 — Personal Fitness Experiments
**Objective**: Allow the user to run small self-directed experiments (e.g., "try higher frequency for 4 weeks and compare") using the data the app already collects.
**Scope**: Scoped at kickoff — likely a thin layer over existing Progress Intelligence (Phase 9) comparing two date ranges, rather than new tracking primitives.
**Deliverables**: TBD at phase kickoff.
**Acceptance criteria**: TBD at phase kickoff.
**Definition of Done**: TBD at phase kickoff.
**Dependencies**: Phase 9.

---

## Phase 15 — Production / PWA / Native Preparation
**Objective**: Make the app installable, resilient, and ready for wider use; confirm (but do not build) native-app direction.
**Scope**: Web app manifest, service worker for offline shell, CI/CD pipeline, confirmed hosting target, basic monitoring/error reporting. Explicitly do not begin native app development in this phase — evaluate readiness only.
**Deliverables**: `manifest.json` + icons, service worker, GitHub Actions CI (lint + build, extended with tests as they exist), deployment confirmed and documented.
**Acceptance criteria**: App installs on a mobile device home screen and loads its shell offline; CI blocks merges on lint/build/test failure.
**Definition of Done**: Verified on at least one real mobile device; CI green on the default branch.
**Dependencies**: All prior phases substantially complete — this is a hardening phase, not a feature phase.

---

## Immediate Next Step After Phase 0

Recommended: **Phase 1 (Identity & Account)**, starting with adding CI (lint + build) before any feature work, since there is currently zero automated safety net (see technical-architecture-v1.md §11). This is cheap, low-risk, and protects every subsequent phase.
