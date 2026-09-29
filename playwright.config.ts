import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// End-to-end tests: the real app against a local Supabase (`npm run db:start`). Supabase URL and
// keys come from the environment, or from .env.local like `next dev` (CI sets them from
// `supabase status`). See e2e/README.md.
loadEnvConfig(process.cwd());

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
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
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // CI tests the production build; locally, the dev server is enough.
    command: isCI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
