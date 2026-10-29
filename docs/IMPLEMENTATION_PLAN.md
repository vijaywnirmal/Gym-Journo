# Implementation plan — 2026-10-29

Fits the current stack: Next.js Server Actions, plus Supabase RLS and SECURITY DEFINER RPCs. No new
services. Each phase is one or more small PRs against `master`, and each needs green CI (lint,
typecheck, unit, SQL, E2E) and a green Production E2E after deploy.

## Phase 0 — Housekeeping (no app behaviour change)

1. Resolve the local checkout.
   - `feat/apple-redesign` is merged and 71 commits behind.
   - Move the uncommitted quick-workout work onto a new branch from `origin/master` and resolve
     conflicts in `page.tsx`, `log/[date]/*` and `queries.ts`.
   - Keep the CRLF fix in `programs.test.ts`.
2. Remove `gym-journal-test-accounts.txt` from the repo root, and ignore the pattern.
3. Enable the Migrate production database workflow (owner action: variables and secrets).

**Exit:** a clean tree on a branch from master, local `npm test` green on Windows, and the
migrate workflow not skipped.

## Phase 1 — Security and reliability (release blockers)

**1a. Dependency upgrade (R1).**
- Change: `next` and `eslint-config-next` to 16.4.3, `zod` ≥ 4.6.6, `sharp` 0.35.5.
- Tests: the existing suite, plus a manual check of `/share/workout/[date]` and exercise demo
  images.
- Exit: `npm audit --omit=dev` clean of critical/high, CI green, Production E2E green.

**1b. Reminder delivery (R2).**
- Make the job robust to scheduler lateness. Widen the due window to the rest of the person's
  local day, so "due" means "reminder time has passed today, not sent today, not logged today,
  planned workout today". Keep the one-a-day guard (`reminder_last_sent_on`).
- Done as a new function signature or default in a migration. The old cron call keeps working
  (README's add-before-remove rule).
- Optionally move the trigger to Vercel Cron, Supabase `pg_cron`, or an external pinger. That is
  a documented decision; it is not required once the window is robust.
- Tests: SQL test in `workout_reminders.sql` for "scheduler 5 h late still sends once", "after
  midnight local doesn't send yesterday's", and "logged already → none". Unit test on the route.
- Rollback: the previous function stays callable.

**1c. Keep fee history (R3).**
- Migration:
  - `fees.trainer_id` and `fees.gym_id` become `on delete set null`.
  - Relax the `fees_one_payee` check to cover ended fees whose payee is gone.
  - Add `payee_name` captured at creation.
  - `stop_training` ends active fees instead of deleting them.
- The same treatment applies to the gym owner's account deletion. Alternatively, block deletion
  while they own a gym with members; this is a product decision.
- Tests: SQL tests for both paths. The member's Profile still lists ended fees.
- Rollback: additive columns. The FK change is reversible.

**Phase exit:** the definition of done in the brief, with SQL tests and E2E for each.

## Phase 2 — Trainer workflow (validate with the pilot)

1. **D1, attention list.** Extend `trainer_client_overview` (new columns only) and add a pure
   ranking function in `src/lib/clientStatus.ts` with unit tests. Show a reason per client.
2. **D3, conflict warning.** Pass the plan's `updated_at` (or a version column) into
   `save_workout_plan` and `save_client_plan`. On mismatch, return a typed error and show who
   changed it.
3. **D2, private trainer notes and weekly check-in.**
   - New tables, RLS owner-only, read via trainer RPCs.
   - SQL tests for: client can't read the trainer's notes; ended trainer can't read either.
4. **S4, notification coalescing** for trainer plan pushes.

**Exit:** pilot trainer uses the attention list weekly, with no lost-edit reports.

## Phase 3 — Member depth

D4 goals and D5 substitutions. Each comes with unit tests for the maths, a SQL test for access, and
an E2E test for the main flow.

## Phase 4 — Gym operations (only with a gym asking)

D6 ownership transfer and multi-gym selection, then equipment/maintenance as its own module if
validated. The equipment module would need:

- `gym_equipment`, `equipment_issues` and `equipment_service_log` tables, all RLS via
  `require_gym_admin`.
- Members can create issues only for their active gym.

## Design system direction

There is an existing token-based Tailwind 4 system (`globals.css`, the Apple-style redesign, and
`components/ui/*`). Keep it and document it rather than replace it:

- **Typography.** System font stack, 4 sizes in use (title, body, label-2, caption). Tabular
  numerals for every metric.
- **Colour.** Semantic tokens only (`accent`, `label-*`, `separator`, `teal`, `orange`) with dark
  as the primary theme. Add a token audit to ensure no raw hex in components.
- **Layout.**
  - Member: single column, `max-w-md`, bottom-reachable primary actions, 44 px targets.
  - Trainer: list/detail, two columns from `md`.
  - Gym: dense tables from `md`, cards below `md`.
- **Components to standardise.** A data table (gym and trainer lists), status pill (exists as
  `DayStatusPill`), stat tile, empty/error/loading states, and a form field with inline error.
- **Accessibility.** Add `@axe-core/playwright` to the existing E2E specs. That is a single dev
  dependency, justified by the lack of any automated a11y gate.

## Observability, deploy, rollback

- **Observability.** Vercel logs and alerts (pilot checklist), plus structured `console.error` on
  RPC failures. Add a reminder-job summary (sent/skipped/due) to the workflow output, which
  partly exists already.
- **Deploy.** Vercel from master. Migrations by workflow, written expand-then-contract.
- **Rollback.** Vercel instant rollback for the app. Migrations are additive, so the old app
  keeps working. Down-migrations aren't used; a fix-forward migration is the rollback.
