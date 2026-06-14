import { defineConfig, devices } from "@playwright/test";

/**
 * E2E / browser-QA config. Specs live in `e2e/` so the vitest unit runner
 * (which globs `src/**​/*.test.ts`) never picks them up, and the app `tsc`
 * build (`include: ["src"]`) never compiles them.
 *
 * Per DESIGN.md ("browser-check desktop and mobile after every visual change")
 * every spec runs against both a desktop and a mobile viewport.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
