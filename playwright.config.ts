import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// End-to-end tests: the real app against a local Supabase (`npm run db:start`). Supabase URL and
// keys come from the environment, or from .env.local like `next dev` (CI sets them from
// `supabase status`). With E2E_BASE_URL set they run against that deployed site instead, as an
// existing account and only the specs tagged @prod-safe. See e2e/README.md.
loadEnvConfig(process.cwd());

// The same switches e2e/testUser.ts reads, taken from process.env here because an imported module
// would be evaluated before loadEnvConfig runs.
const remoteBaseURL = process.env.E2E_BASE_URL || null;
const isRemote = remoteBaseURL !== null;

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = remoteBaseURL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  // The specs share one test user, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    timezoneId: process.env.E2E_TIMEZONE || "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "phone",
      // On a deployed site, only the specs that read or clean up after themselves.
      grep: isRemote ? /@prod-safe/ : undefined,
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  // A deployed site is already running.
  webServer: isRemote
    ? undefined
    : {
        // CI tests the production build; locally, the dev server is enough.
        command: isCI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
});
