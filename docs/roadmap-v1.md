# Gym-Journo — Roadmap v1

Status: Draft for product-owner review. Reflects Phase 0 audit as of 2026-09-16. Phase numbering matches the kickoff brief.

Legend for "Dependencies": phases that must be functionally complete (not necessarily merged, but working) before this phase starts.

---

## Phase 0 — Product & Technical Foundation
**Objective**: Establish a reliable, honest baseline of what exists before changing anything.
**Scope**: Repository audit; this document set.
**Deliverables**: `docs/product-specification-v1.md`, `docs/technical-architecture-v1.md`, `docs/roadmap-v1.md`.
**Acceptance criteria**: All three docs exist, accurately reflect the current codebase (verified against actual files, not assumed), and unresolved decisions are explicitly listed rather than silently decided.
**Definition of Done**: Product owner has reviewed and either approved or corrected the audit's findings and open decisions.
**Dependencies**: None.
**Status**: This phase — complete pending review.

---

## Phase 1 — Identity & Account
**Objective**: Make authentication complete and correct, without redesigning what already works.
**Scope**:
- Forgot-password / reset-password flow (`resetPasswordForEmail` + reset page).
- Explicit account-deletion flow (self-serve, with confirmation).
- Decide and implement email-verification posture (in-app gate vs. Supabase-project-only).
- Decouple password-setting from onboarding if the product owner confirms that's desired (open decision #2 in product spec).
- Commit the pending `middleware.ts` → `proxy.ts` migration as its own reviewable commit.
**Deliverables**: Reset-password page + action, account-deletion page + action, updated `.env.local.example` if new redirect URLs are needed.
**Acceptance criteria**: A user can reset a forgotten password end-to-end; a user can delete their account and all owned rows cascade-delete (verify via existing `on delete cascade` FKs); no regression to existing sign-in flows.
**Definition of Done**: Manually verified against a real Supabase project (not just RLS review); matches product spec §7.1.
**Dependencies**: Phase 0 approved.

---

## Phase 2 — Onboarding & Goals
**Objective**: Make the fitness goal a real, structured input rather than a display-only field.
**Scope**: Resolve open decision #1 (single field vs. goal history) with the product owner; if history is chosen, add `goal_history` with RLS matching the `profiles` pattern; otherwise explicitly document that `profiles.goal` remains the single source and defer history.
**Deliverables**: Schema migration (if history chosen), updated onboarding/profile UX if the goal model changes shape.
**Acceptance criteria**: Goal changes are captured however the product owner decided; no feature reads `profiles.goal` inconsistently with the decision.
**Definition of Done**: Goal model documented in `docs/technical-architecture-v1.md` as no longer "provisional."
**Dependencies**: Phase 1 (if onboarding UX changes alongside password decoupling).

---

## Phase 3 — Home / Dashboard
**Objective**: Evolve "Today" from a single-day status card into the dashboard implied by the target journey (goal-aware, surfaces what needs attention).
**Scope**: Keep the existing plan/log status card; add goal-aware framing once Phase 2 lands; do not add unrelated widgets.
**Deliverables**: Updated `/` page.
**Acceptance criteria**: Existing Today functionality (plan display, rest-day display, log CTA) has zero regression; new elements are additive.
**Definition of Done**: Verified in browser against a seeded account with a plan, a rest day, and no plan.
**Dependencies**: Phase 2.

---

## Phase 4 — Exercise System
**Objective**: Close small gaps in the existing, largely-working exercise library.
**Scope**: Evaluate whether "exercise variants" (product spec's candidate entity) are actually needed yet — current audit finding is **no**, custom exercises already cover this informally. Re-scope only if a concrete Phase 5/6 need emerges.
**Deliverables**: None expected unless a real gap surfaces during Phase 5/6 work.
**Acceptance criteria**: N/A unless scoped.
**Definition of Done**: N/A unless scoped.
**Dependencies**: None additional.

---

## Phase 5 — Workout Planning
**Objective**: Close the biggest planning gap: no recurring/template plans, every date planned individually.
**Scope**: Add a lightweight "repeat this plan" or template mechanism — exact design (duplicate-on-demand vs. true recurrence rule) is an open design question for this phase, not decided in Phase 0.
**Deliverables**: Schema/UX proposal reviewed with product owner before implementation.
**Acceptance criteria**: A user can create a plan once and apply it to multiple future dates without re-entering exercises each time.
**Definition of Done**: Verified for at least a 2-week recurring pattern; existing single-date planning flow unaffected.
**Dependencies**: Phase 3.

---

## Phase 6 — Gym Mode
**Objective**: Build the missing in-gym execution experience — the target journey names this explicitly and it does not exist today.
**Scope**: A set-by-set logging UI distinct from the current after-the-fact form: current exercise/set highlighted, quick reps/weight entry, optional rest timer. Writes to the same `workout_logs`/`logged_exercises`/`logged_sets` tables — no new schema needed.
**Deliverables**: New route or mode within `/log/[date]`.
**Acceptance criteria**: A user can complete an entire planned workout through Gym Mode with fewer taps than the current form for the common case (pre-filled from `planned_exercises`).
**Definition of Done**: Verified on a mobile viewport; existing freeform logging (no plan) still works.
**Dependencies**: Phase 5.

---

## Phase 7 — Journal & History
**Objective**: Fix the hard 60-row cap; make history genuinely browsable over months, not just weeks.
**Scope**: Real pagination or infinite scroll on `/history`.
**Deliverables**: Updated `getLogHistory` + page.
**Acceptance criteria**: A user with 200+ logs can browse all of them.
**Definition of Done**: Verified against a seeded account with >60 logs.
**Dependencies**: None additional (independent of Gym Mode).

---

## Phase 8 — Body & Transformation
**Objective**: Add the missing body-measurement and progress-photo tracking named in the product mandate.
**Scope**: `body_measurements` table (weight, and optionally other measurements, `user_id`-scoped, RLS `own` policy matching existing pattern); progress photos stored in Supabase Storage with a private bucket + RLS-equivalent storage policy, metadata row referencing the storage path. Privacy is a hard requirement here — private by default, no sharing surface.
**Deliverables**: Migration(s), storage bucket + policy, upload/view UI.
**Acceptance criteria**: A user can log a body measurement and upload a progress photo; no other user (including via a leaked URL, if using signed URLs) can view it.
**Definition of Done**: Storage access verified with a second test account attempting to read another user's photo.
**Dependencies**: None additional.

---

## Phase 9 — Progress Intelligence
**Objective**: Turn logged data into actual insight — the first real "Analyze" step in the core loop.
**Scope**: Per-exercise progression charts (weight/reps over time from `logged_sets`), basic adherence metric (planned vs. logged days), simple plateau flag (e.g., no weight increase over N sessions for a given exercise). No AI involved yet — purely deterministic analytics over existing structured data.
**Deliverables**: New `/progress` screen (or equivalent), added to `BottomNav` if it becomes a primary destination.
**Acceptance criteria**: Charts/metrics are computed correctly against seeded historical data (spot-checked manually).
**Definition of Done**: Verified against an account with several weeks of varied log data.
**Dependencies**: Phase 7 (needs browsable history to validate against) and Phase 8 (weight trend context).

---

## Phase 10 — Recovery
**Objective**: Add the missing recovery-tracking concept.
**Scope**: `recovery_entries` table (soreness/sleep/subjective readiness, `user_id`-scoped, RLS `own`) — minimal fields, resist scope creep here (product philosophy: don't build features because competitors have them; keep to what analysis/coaching will actually consume).
**Deliverables**: Migration, simple daily entry UI.
**Acceptance criteria**: A user can log a recovery entry per day; data is queryable per date range for future AI context.
**Definition of Done**: Verified end-to-end; RLS isolation tested.
**Dependencies**: None additional.

---

## Phase 11 — Adaptive Training
**Objective**: First real adaptive behavior — deterministic rule-based adjustments, not yet full AI coaching.
**Scope**: e.g., auto-flag when Phase 9's plateau detector fires, suggest (not silently apply) a target-weight/rep change for the next planned session of that exercise. This is the proving ground for the `recommendation`/`user_override` schema described in the technical architecture doc — build it here even though "AI Coach" is a later phase, because adaptive training needs it first and AI Coach (Phase 13) should reuse it rather than invent a parallel mechanism.
**Deliverables**: `recommendations` table (+ RLS), UI to accept/reject a recommendation, which writes to `planned_exercises` only on explicit accept.
**Acceptance criteria**: A recommendation is explainable (references the specific logged data that triggered it), never auto-applies, and is fully overridable.
**Definition of Done**: Verified that rejecting a recommendation leaves the plan untouched, and accepting it produces the exact stated change.
**Dependencies**: Phase 9.

---

## Phase 12 — Nutrition
**Objective**: Move nutrition from "free text fed to a prompt" toward lightly structured data, without over-building a full macro tracker.
**Scope**: Scope to be confirmed with product owner — minimum viable extension is structured calorie/protein estimates attached to `nutrition_logs` entries (could be AI-assisted parsing of the existing free text rather than a manual macro-entry UI, consistent with "AI as reasoning layer over structured data" once the estimate itself becomes a stored, queryable field instead of prompt-only).
**Deliverables**: TBD pending scoping conversation.
**Acceptance criteria**: TBD.
**Definition of Done**: TBD.
**Dependencies**: Phase 2 (goal informs nutrition targets).

---

## Phase 13 — AI Coach
**Objective**: Evolve `/ai-plan` from a one-shot markdown generator into the "coach-like, explainable, user-controlled" experience the mandate describes.
**Scope**: Reuse the `recommendations` mechanism from Phase 11 so AI output can propose structured, acceptable/rejectable changes to `workout_plans`/`planned_exercises` — not just render markdown. Keep the existing grounded-prompt approach (profile + real training/schedule summaries) as the reasoning input; the change is in the *output* becoming structured-plus-explanation rather than markdown-only. Preserve the existing daily rate limit.
**Deliverables**: Updated `ai-plan` actions producing structured proposals; UI to accept/reject each proposed change individually (not all-or-nothing).
**Acceptance criteria**: A user can accept one proposed workout change without accepting the whole plan; every proposal states which data it's based on.
**Definition of Done**: Verified that an accepted AI proposal produces the exact same `planned_exercises` state a manual edit would.
**Dependencies**: Phase 11 (recommendation mechanism), Phase 9 (data worth recommending against).

---

## Phase 14 — Personal Fitness Experiments
**Objective**: Support user-driven "try this for N weeks and see" experiments (e.g., testing a new rep range).
**Scope**: To be defined with product owner once Phases 9–13 establish what data is available to evaluate an experiment against. Explicitly not scoped in this document — avoid speculative design here per "do not implement future phases prematurely."
**Deliverables**: TBD.
**Acceptance criteria**: TBD.
**Definition of Done**: TBD.
**Dependencies**: Phase 9, Phase 13.

---

## Phase 15 — Production / PWA / Native Preparation
**Objective**: Make the app installable and reliable under flaky connectivity, and lay groundwork (not implementation) for eventual native apps.
**Scope**: `manifest.json`, icons, service worker/offline strategy prioritizing the logging flow, confirm and document actual deployment target (currently unconfirmed — see technical architecture §13), basic CI (lint/build/typecheck on PR) since none exists today.
**Deliverables**: Working installable PWA; CI workflow.
**Acceptance criteria**: App passes a Lighthouse PWA audit at a reasonable bar; logging a workout works offline and syncs when reconnected (or is explicitly scoped out with product-owner sign-off if too costly for v1).
**Definition of Done**: Verified on an actual mobile device, not just desktop devtools emulation.
**Dependencies**: All prior phases functionally stable — this is a hardening phase, not a feature phase.

---

## Notes on Sequencing

This order follows the kickoff brief's phase numbers, which already reflect a sensible dependency chain (identity → goals → planning → execution → analysis → coaching). The one deliberate insertion is that **Phase 11 (Adaptive Training) builds the `recommendation`/`user_override` schema that Phase 13 (AI Coach) depends on** — building it twice, once informally for adaptive rules and again for AI output, would violate the "simplest architecture" principle. If the product owner wants to reorder (e.g., ship a thin AI Coach before Adaptive Training), the recommendation schema should still be introduced in whichever phase comes first.
