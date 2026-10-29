# Security review — 2026-10-29 (`origin/master` @ `4bb3c3c`)

Scope:

- Every migration that defines access (0001, 0031, 0033, 0034, 0037, 0039, 0040).
- The proxy, the auth callback and cron auth.
- Every service-role call site.
- The trainer, gym and fee server actions.

"Verified" means read in code and, where noted, observed. Nothing was exploited against production.

## Model

- Every table has RLS. People's own data (plans, logs, sets, body, AI history) is readable and
  writable only by `auth.uid() = user_id`.
- Trainer, gym and fee access never widens those policies. It goes through `SECURITY DEFINER`
  functions with `set search_path = public`. Each starts with `require_trainer_of`,
  `require_gym_admin` or `managed_fee`, which re-derive the caller from `auth.uid()`; the app does
  not supply the caller.
- Internal helpers are `revoke`d from `authenticated`. Write RPCs are revoked from `anon` (0033).
- Gyms see counts and dates only. Trainers see plans, logs and body weight, and never DOB, height,
  gender, email, Coach, AI plans, meals or reminders.

## Findings

| ID | Severity | Finding | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| S1 | **Critical**. **Fixed on `chore/upgrade-next`** | `next@16.3.5` has published advisories, including RCE in `next/og` `ImageResponse` and in the Image Optimization API, SSRF in image optimization, and Server Action DoS. The app uses **both** `ImageResponse` (`src/app/share/workout/workoutImage.tsx`) and `next/image` (`ExerciseDemo.tsx`). `zod <4.6.6` (memory exhaustion), `sharp`, and `source-map-js` are also flagged | `npm audit --omit=dev` | Done: `next` and `eslint-config-next` 16.4.3, `zod` 4.6.7, `sharp` 0.35.5, plus patch-level `source-map-js`, `brace-expansion` and `vite`. `npm audit --omit=dev` reports 0 vulnerabilities. Still open: dev-only `vitest@3` advisories (critical, via `tinypool` and `@vitest/mocker`), which need the major upgrade to vitest 5, and is a separate change |
| S2 | High (operational) | Production test-account password stored in plaintext in an untracked, **un-ignored** file at the repo root | `gym-journal-test-accounts.txt` | Move it to a password manager and delete the file. Add `*accounts*.txt` or similar to `.gitignore`. Rotate the password if it was ever shared |
| S3 | Medium (data integrity / privacy) | Deleting a trainer profile (`stop_training`, or account deletion) cascades to `fees` and `fee_payments`, erasing **clients'** payment records. A gym owner's account deletion erases the gym, member history and fees. Records other people rely on are destroyed without their action | 0039, 0040 `on delete cascade` | Retain fee records: end them instead of deleting them, and make `fees.trainer_id` / `gym_id` `on delete set null` with a denormalised payee name. Add a SQL test |
| S4 | Medium | Rate limits exist only for AI. Sign-up, invite creation, `create_gym`, fee writes and push-triggering actions (`saveClientPlan` → `notifyUser`) are unbounded per user. A trainer could spam a client's devices with notifications | `src/app/trainer/clients/[id]/actions.ts` | Coalesce or limit trainer notifications (e.g. one per client per N minutes). Confirm Supabase Auth rate limits and CAPTCHA are on |
| S5 | Low | Member poster links never expire by design. Anyone with a photo of the poster can join, and the gym then sees their name and activity. The member consents by joining, but the gym cannot approve or deny | 0037 `gym_invites.expires_at null` | Acceptable for the pilot. Later add optional "approve new members" |
| S6 | Low | No script CSP (documented trade-off). Markdown is rendered with `react-markdown` (no raw HTML), so the XSS surface is low | `next.config.ts` | Revisit with nonces once Next's nonce support fits the caching model |
| S7 | Low | `can_manage_fee` and `is_trainer_of` are callable by any signed-in user. They only answer about the caller's own relationships, so nothing leaks | 0034, 0040 | None |
| S8 | Info | Migrations reach production by hand (the workflow is opt-in and skipped). There is a risk of drift between the code and the schema | `gh run list --workflow=migrate.yml` | Set up the workflow's variables and secrets, and add a startup or E2E check of `max(version)` |

### Checked and found sound

| Risk | Result |
| --- | --- |
| IDOR on client data | `client_plans`, `client_logs`, `client_body_weights`, `client_custom_exercises`, `save_client_plan`, `delete_client_plan` and `apply_program_for_client` all call `require_trainer_of(p_client_id)` against `auth.uid()` with `status='active'`. An ended link loses access at once |
| Cross-gym access | Every gym RPC calls `require_gym_admin(p_gym_id)`. RLS on `gym_*` limits rows to self or admins. Admin links are owner-only and single-use (row lock) |
| Role escalation | Only the owner can create or remove admins. Staff rows are written only through RPCs. `gyms` column-level `update` grant excludes `owner_id` |
| Trainer offers | A trainer gains no access until the member accepts by name. `trainer_runs_gym` flags an owner or admin posing as a trainer |
| Fees | Writes are via `managed_fee` (row lock + manager check + active). Reads are limited to payer or manager. Only the latest payment can be undone |
| Plan authorship | Stamped by trigger from `auth.uid()` and cannot be forged by the app |
| AI-limit tampering | Fixed in 0031 (append-only rows) |
| Anon | Write RPCs and the library are revoked from anon (0033). `/api/*` returns 401 signed out (verified on production) |
| Open redirect | `/auth/callback` uses `safeRedirectPath`. Proxy redirects use fixed paths |
| Cron | Bearer secret compared in constant time. Production returns 401 without it (verified) |
| Service role | Server-only (`src/lib/supabase/admin.ts`). Used only after authorization, or for the caller's own deletion |
| Secrets | `.env*` gitignored. Only `.env.local.example` is tracked. No secrets in tracked files (pattern search) |
| Private files | No user file uploads exist. Exercise demo images are public, static and public-domain |

### Not verified

- SQL tests (no Docker or psql here).
- Live RLS behaviour with two real sessions.
- Supabase Auth settings: password policy, rate limits, email confirmation, leaked-password
  protection.
- Vercel environment scoping.
- Backup / PITR configuration on the Supabase plan.
