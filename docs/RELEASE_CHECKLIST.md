# Release checklist

For each production release. It complements `docs/pilot-checklist.md`, which covers the pilot
itself.

## Before merging

- [ ] PR targets `master`, contains only intended files, and has no credentials or `.env*` changes.
- [ ] CI green: lint, typecheck, unit tests, build, SQL tests and E2E (the `integration` job).
- [ ] New or changed RPCs: `revoke … from public, anon`, `grant … to authenticated`, internal
      helpers revoked from `authenticated`. A SQL test covers the denied case, i.e. another
      trainer, another gym, or an ended link.
- [ ] Migrations are additive (expand-then-contract). The old app works against the new schema and
      vice versa.
- [ ] No cascade deletes data that belongs to someone other than the person deleting.
- [ ] `npm audit --omit=dev` has no critical or high advisories.
- [ ] UI changes checked at 375 px and desktop, with keyboard-only navigation and visible loading,
      empty, error and success states.

## After merging

- [ ] **Migrate production database** ran and passed (not skipped).
- [ ] `select max(version) from supabase_migrations.schema_migrations;` matches the latest
      migration in the repo.
- [ ] Vercel production deployment is the merge commit.
- [ ] **Production E2E** passed for that deployment.
- [ ] If reminders changed: a manual **Send workout reminders** run passes and reports counts.
- [ ] Vercel Logs show no new 5xx errors in the first hour.

## Rollback

- App: Vercel → Deployments → previous production → **Instant Rollback**.
- Database: don't revert. Ship a fix-forward migration, which the additive rule makes safe.
