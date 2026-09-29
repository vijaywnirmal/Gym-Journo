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
