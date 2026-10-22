# End-to-end tests

Playwright specs that drive the real app (phone viewport) against a local Supabase.

```bash
npm run db:start      # local Supabase: every migration + seed.sql (needs Docker)
npm run test:e2e      # starts `next dev` on port 3100 unless one is already running there
```

The Supabase URL and keys come from the environment or `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — `npx supabase status` prints the
local ones). CI runs the same specs against the production build (`next start`).

- `auth.setup.ts` recreates the test user (`e2e@example.test`) from scratch and signs in through the
  login form once; the specs reuse that session. The service role key is only used for this setup.
- Specs run one at a time because they share that user.
- On failure, traces and screenshots land in `test-results/` (`npx playwright show-trace <zip>`).

## Against a deployed site (production)

With `E2E_BASE_URL` set, the same specs run against that site instead of a local server:

```bash
E2E_BASE_URL=https://www.gymjourno.fit E2E_EMAIL=… E2E_PASSWORD=… E2E_FIRST_NAME=… \
  E2E_TIMEZONE=Asia/Kolkata npm run test:e2e
```

- They sign in as an existing, dedicated test account through the login form. Nothing creates or
  deletes users, and no service role key is needed. Use an account that is only for testing.
- Only the specs tagged `@prod-safe` run: they only read, or remove what they create (a custom
  exercise with a unique name, a rest day a year ahead). Logging a workout stays local-only,
  because a log can't be deleted.
- No spec signs out: signing out ends every session of the account.
- `E2E_FIRST_NAME` is the account's first name (checked in the greeting). `E2E_TIMEZONE` must match
  the account's time zone, because the browser runs in it and would otherwise change the account's
  zone through TimezoneSync.

The **Production E2E** workflow ([`.github/workflows/e2e-production.yml`](../.github/workflows/e2e-production.yml))
runs them after every successful production deploy, and on demand from the Actions tab. It needs,
under Settings → Secrets and variables → Actions:

- secrets `E2E_EMAIL` and `E2E_PASSWORD`;
- variable `E2E_FIRST_NAME`, and optionally `E2E_TIMEZONE` (default `UTC`) and `E2E_BASE_URL`
  (default `https://www.gymjourno.fit`).
