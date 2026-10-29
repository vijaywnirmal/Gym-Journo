# Baseline audit — 2026-10-29

Read-only audit. No application code, schema or production data was changed.

## What was audited

- **Code audited: `origin/master` @ `4bb3c3c`** ("Show fee and trainer messages with the refreshed
  page", PR #24). This is what Vercel deploys.
- **The local checkout is stale.** It is on `feat/apple-redesign` @ `4a1b9bd`, which is fully merged
  into master and **71 commits behind `origin/master`**. Its remote branch has been deleted. It has
  none of the trainer, gym or fee work (migrations 0031–0040).
- **Uncommitted work in the local checkout:**
  - "Quick workouts" for the comeback card: `src/lib/quickWorkouts.ts`, its test,
    `src/components/QuickWorkoutList.tsx`, and edits to `page.tsx`, `log/[date]/*` and `queries.ts`.
  - A CRLF fix in `src/lib/programs.test.ts`.
  - `.claude` added to `.gitignore`.
  - Master has since changed all four edited source files, so rebasing this work onto master
    will conflict.
- **`gym-journal-test-accounts.txt` is untracked and not gitignored.** It holds the shared password
  for permanent production test accounts, so one `git add .` would commit it. Its values were not
  printed during the audit.

Method: master was exported with `git archive` into a scratch folder and checks ran there, so the
user's working tree was never touched.

## Architecture (verified from code)

| Area | Finding |
| --- | --- |
| Framework | Next.js 16.3.5 App Router (Turbopack), React 19.2, TypeScript, Tailwind 4 |
| Data / auth | Supabase (Postgres + Auth). Email + password, magic link and `token_hash` email links. Sessions are verified in `src/proxy.ts` with `getClaims()` |
| Authorization | Row-level security on every table. Cross-user access goes **only** through `SECURITY DEFINER` RPCs that check the caller first (`require_trainer_of`, `require_gym_admin`, `managed_fee`). The service role is used in three places: account deletion, the reminders cron, and `notifyUser` (push after an RPC has authorized the action) |
| Server surface | Server Actions per route, 4 route handlers (`/api/exercises*`, `/api/cron/reminders`, `/auth/callback`, `/share/workout/[date]`) |
| AI | Gemini, behind consent and daily limits counted from append-only rows (0031). Coach answers are validated against the person's own records |
| Push | Web push (VAPID). A GitHub Actions cron calls `/api/cron/reminders` |
| Deploy | Vercel from `master`. **Migrate production database** workflow (opt-in). Production E2E after each deploy |
| Roles | Member (default). Trainer (`trainer_profiles` row). Gym owner (`gyms.owner_id`). Gym admin and gym trainer (`gym_staff`). Gym member (`gym_members`). No organisation or branch level: one gym is one location |

Routes: 44 (from the build output). The member routes are Today, calendar, schedule, log, history,
progress, body, exercises, programs, coach, ai-plan, suggestions and profile. There are also trainer
routes (`/trainer/**`, `/join/[code]`), gym routes (`/gym/**`, `/g/[code]`), auth pages and privacy.

Tables: 18 member tables, plus `trainer_profiles`, `trainer_invites`, `trainer_clients`, `gyms`,
`gym_staff`, `gym_members`, `gym_invites`, `gym_trainer_offers`, `fees` and `fee_payments`.

## Baseline checks (run 2026-10-29 on the master export, Windows, Node 24.21)

| Check | Result |
| --- | --- |
| `npm ci` | pass |
| `npm run lint` | **pass** (0 problems) |
| `npm run typecheck` | **pass** |
| `npm test` (Vitest) | **1153 tests passed. 1 suite failed to load:** `src/lib/programs.test.ts` cannot parse migration 0021 on a CRLF (Windows) checkout. This is environment-only: CI on Linux is green, and the user's uncommitted change fixes it |
| `npm run build` | **pass** (44 routes) |
| `npm run test:sql` (12 files) | **not run**: Docker daemon not running, `psql` not installed |
| `npm run test:e2e` (7 specs, 18 tests) | **not run**: needs local Supabase (Docker) |
| `npm audit --omit=dev` | **1 critical, 3 high**. See SECURITY.md S1 |
| GitHub CI (last 6 runs) | all green. Production E2E green for the last 3 master deploys |
| Migrate production database | **skipped on every recent run**. The opt-in variables aren't set, so production migrations are applied by hand |
| Send workout reminders | runs succeed, but GitHub ran the "every 15 min" schedule **only every 4–7 hours**. See below |

## Production (https://www.gymjourno.fit), signed out only

- `/` redirects to `/login`. There is no public landing page. The product is branded **"Gym
  Journal"** on the domain gymjourno.fit.
- `/login` and `/login?role=trainer` render correctly at desktop and at 375×812 (screenshots
  taken). There is no gym sign-up entry on the login page. Gyms are reached via invite links or a
  `?role=` link.
- Response headers: HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy` and `Permissions-Policy` are all present. There is no script CSP (documented as
  deliberate).
- `GET /api/exercises` signed out returns `401 {"error":"Not signed in"}`.
  `POST /api/cron/reminders` without a secret returns 401.
- **Authenticated screens were not verified in a browser.** The only credentials are for permanent
  *production* accounts, and signing in to production with them is out of bounds for this audit.

## Verified defects

1. **Workout reminders are mostly not sent.**
   - `due_workout_reminders` (0030) only matches people whose local reminder time fell in the
     last 3 hours.
   - GitHub's scheduled runs actually arrived at 01:07, 06:06, 12:51, 18:54 and 22:55 UTC on
     2026-10-26 (gaps of 4–7 h).
   - So any reminder time in a gap is skipped for the day, which is roughly a third or more of
     all reminder times.
   - Evidence: `gh run list` history, `supabase/migrations/0030_add_workout_reminders.sql:75-95`,
     `.github/workflows/reminders.yml:11`.
2. **A trainer who stops training wipes their clients' fee records.**
   - `stop_training()` (0039) deletes `trainer_profiles`. `fees.trainer_id … on delete cascade`
     (0040) then cascades to `fee_payments`.
   - The client's payment history disappears from their Profile. Deleting the trainer's account
     does the same.
   - Similarly, a gym owner deleting their account cascades the gym, its member history and all
     its fee records. No ownership transfer exists.
   - Verified from the schema, not executed.
3. **Windows test failure**, described above (environment-only).

## Feature completion matrix

Legend: ✅ implemented, and tested in code or CI · 🟡 partial · ❌ missing · ❓ unknown (not
verifiable without signing in).

| Feature | Status | Evidence / gap |
| --- | --- | --- |
| Sign-up, login, magic link, reset | ✅ | `login/`, `auth/callback` (safe `next` redirect), Production E2E signs in |
| Onboarding (18+, profile) | ✅ | `onboarding/`, proxy gate, actions tests |
| Account deletion | 🟡 | Works, but cascades erase gym and fee history for *other* people (defect 2) |
| Exercise library (~740, search, filters, demos) | ✅ | API + SQL keyset paging, SQL and E2E tests |
| Custom exercises | ✅ | `exercises/actions.ts` + tests |
| Schedule a day / rest / absence | ✅ | `save_workout_plan` RPC, E2E `schedule-and-log` |
| Templates, multi-week programs | ✅ | RPCs 0019/0022, unit tests |
| Workout logging (sets, reps, load, RPE, set types, notes) | ✅ | `save_workout_log` RPC, constraints 0009, offline queue |
| Planned vs actual, previous session, "same as last time" | ✅ | M3, `setComparison` |
| Rest timer, plate calculator | ✅ | M2/M3 |
| PRs, PR history, progress charts | ✅ | M1/M8, `TrendChart` |
| Weekly muscle volume, streaks, adherence | ✅ | M7, SQL stats functions 0026 |
| Body weight / measurements | ✅ | `body/` |
| Coach (AI) with evidence + consent + limits | ✅ | `lib/coach/*`, extensive tests |
| AI diet/workout plan | ✅ | Consent, append-only limits |
| Exercise substitutions | ❌ | No swap-for-equivalent flow |
| Goals (target lift/weight/date) | 🟡 | Only a profile `primary_goal` label. No measurable goals |
| Workout reminders | 🟡 | Implemented, but delivery is unreliable (defect 1) |
| PWA / offline logging | ✅ | `sw.js`, `useOffline`. Not verified on device |
| Trainer: sign-up, invite links, accept | ✅ | 0034, `trainers.sql`, E2E `trainer.spec` |
| Trainer: roster/dashboard with today and week status | ✅ | `trainer_client_overview` |
| Trainer: plan client days, apply programs | ✅ | `save_client_plan`, `apply_program_for_client` |
| Trainer: review client logs and body weight | ✅ | `client_logs`, `client_body_weights` (120-day window) |
| Trainer: "needs attention" prioritisation | 🟡 | Per-client status pills. No ranked attention list |
| Trainer: notes, check-ins, messaging | ❌ | None. The pilot checklist says WhatsApp remains the channel |
| Trainer ↔ client concurrent plan edits | 🟡 | Last write wins, with no conflict warning. "Planned by" labels exist (0036) |
| Gym: setup, invites (member QR poster, trainer, admin) | ✅ | 0037, `gyms.sql`, E2E `gym.spec` |
| Gym: member list, activity, quiet members | ✅ | `gym_member_overview` (counts and dates only) |
| Gym: suggest trainer to member (consented) | ✅ | Offers 0037/0038 |
| Gym: roles (owner/admin/trainer) | 🟡 | Fixed roles. No ownership transfer, no granular permissions |
| Fees (tracking, not payments) | ✅ / 🟡 | 0040, `fees.sql`. History-loss defect 2. Overdue uses DB `current_date` (UTC) |
| Billing / online payments | ❌ | Deliberately out of scope ("Gym Journal doesn't take payments") |
| Equipment inventory, maintenance, availability | ❌ | No tables or screens |
| Attendance / check-in | ❌ | Not present |
| Multi-branch / organisations | ❌ | One gym per owner in the UI (`getAdminGym` uses `.limit(1)`) |
| Operational reporting | 🟡 | Gym trainer overview. `pilot_metrics.sql` (manual) |
| Public landing page | ❌ | `/` goes straight to login |
| Authenticated UI quality (mobile/desktop, a11y) | ❓ | Not browser-verified. Code shows prior a11y work (contrast, focus, titles) |
| Production DB at migration 0040 | ❓ | Migrations applied by hand. Production E2E passing is indirect evidence only |

## Test inventory

- **Unit:** 100 Vitest files, 1153 tests. Heavy on pure logic (`lib/analyze`, `lib/coach`, actions
  with mocked Supabase).
- **SQL:** 12 transaction-rolled-back files in `supabase/tests`. They cover trainers, gyms, fees,
  stop_training, anon access and AI history, so cross-tenant checks do exist at the database
  layer. They were not run here.
- **E2E:** 7 Playwright specs, 18 tests. CI runs them against local Supabase, and a `@prod-safe`
  subset runs against production.

Gaps:

- No tests for: cascade/retention when a trainer or gym owner leaves, the reminder scheduling
  window against real scheduler cadence, and concurrent trainer/client edits.
- No automated accessibility checks (e.g. axe).
- Nothing pins the Next.js version against known advisories.
