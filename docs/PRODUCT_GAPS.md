# Product gaps and priorities — 2026-10-29

Based on [`audit/BASELINE.md`](audit/BASELINE.md). The product today:

- A strong single-person training journal: logging, PRs, analytics, AI coach, programs.
- A working trainer pilot: invite, plan, review.
- An early gym layer: members, trainers, offers, fee tracking.

The pilot checklist (`docs/pilot-checklist.md`) is the business frame: 1 trainer, 5–10 clients, 4
weeks, then decide. Priorities below follow that. Nothing is proposed because competitors have it.

## Release requirements (before pilot or wider use)

| # | Problem | Evidence | Impact | Effort | Acceptance criteria | Metric |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Known critical framework vulnerabilities | SECURITY S1 | Possible RCE on the public site | S | `npm audit --omit=dev` shows no critical/high. CI and Production E2E green | 0 critical/high advisories |
| R2 | Reminders silently skipped | BASELINE defect 1 | Reminders are one of the pilot's three named helpers. Clients miss planned days | S–M | A reminder is sent for any reminder time when the scheduler is up to 6 h late. Still at most one a day. Never sent after the person has logged | Share of planned days with a reminder sent (target ≥ 95%) |
| R3 | A trainer leaving erases clients' fee history | BASELINE defect 2, S3 | Money records lost, and trust lost | M | After `stop_training` or account deletion, the client still sees ended fees and payments. SQL test covers it | 0 fee rows lost in the test |
| R4 | Migrations applied by hand | S8 | A deploy can meet an old schema | S (config) | Migrate workflow runs on merge. Release checklist confirms the version | Workflow runs, not skipped |
| R5 | Credentials file in the repo root | S2 | Accidental commit of prod password | XS | File removed. Pattern ignored | — |

## Differentiators (after release requirements; validate with the pilot)

| # | Persona | Problem | Evidence | Effort | Acceptance criteria | Metric |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Trainer | No ranked "who needs me today" | Status pills exist per client. Pilot asks "what did you still do on WhatsApp" | M | `/trainer` shows clients ordered by a documented rule: missed planned day, no plan this week, quiet ≥ 5 days, fee overdue. Each row says *why* | Trainer opens the app ≥ 4 days a week |
| D2 | Trainer | Notes and check-ins live in WhatsApp | No notes table | M | Private trainer note per client (client can't see). Optional weekly client check-in (energy, soreness, comment) that the trainer sees | Notes per active client per week |
| D3 | Trainer ↔ member | Silent last-write-wins on shared plans | `save_client_plan` / `save_workout_plan` upsert | S–M | Saving a plan changed since it was loaded warns and shows who changed it | 0 lost edits reported |
| D4 | Member | No measurable goals | Only a `primary_goal` label | M | Set a target (lift e1RM, body weight, sessions/week) with an optional date. Today shows progress. The trainer sees it | Goal set rate, and goal hit rate |
| D5 | Member | No exercise substitution | — | S–M | In the logger, "Swap" offers library exercises sharing primary muscle and available equipment. History stays with the performed exercise | Swaps per 100 sessions |
| D6 | Gym | Only one gym per owner, no ownership transfer | `getAdminGym .limit(1)` | M | Owner can hand over ownership to an admin. Deletion is blocked while the owner still owns a gym with members | — |

## Later (need a decision or more evidence first)

- **Equipment inventory, maintenance requests, service history, availability.** Nothing exists
  yet, and no pilot evidence asks for it. This is a separate module (tables, admin screens,
  member-facing "report an issue"). Validate with a gym before building.
- **Attendance / check-in (QR at the door).** It would feed gym reporting, but needs a gym that
  wants it.
- **Multi-branch / organisations.** No evidence of demand. It would change every gym RPC's scope.
  Defer until a chain asks.
- **Online payments / subscriptions (M14).** Explicitly out of scope today. Needs a provider
  decision (e.g. Razorpay for India) and legal review.
- **Health integrations (M11), native shell (M15).** Blocked on a native wrapper decision.
- **AI coaching for trainers.** Only reuse the existing evidence-cited Coach on data the client has
  consented to share with that trainer, and never with medical claims. Not before D1/D2 prove the
  trainer workflow.
- **Public landing page.** `/` goes straight to login. Useful for trainer acquisition after the
  pilot.
- **Brand consistency.** The product is "Gym Journal" on gymjourno.fit. Pick one name.
