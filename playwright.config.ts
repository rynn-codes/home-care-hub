import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests.
 *
 * These exist because of a specific failure. A missing import produced a blank
 * white Home page, and nothing caught it: `vite build` transpiles without type
 * checking, and 648 unit tests all passed because none of them render a page.
 * The only thing that found it was opening the app.
 *
 * So the point of this suite is narrower and more useful than "test the UI". It
 * is: does every screen actually come up, and does anything shout in the
 * console while it does. That is the class of bug unit tests structurally
 * cannot see — a missing import, a broken route, a crash in a provider, a null
 * that only appears once real components mount.
 *
 * Chromium is pre-installed in this environment at PLAYWRIGHT_BROWSERS_PATH, so
 * there is no browser download step. A developer running this locally for the
 * first time needs `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "./e2e",
  // Deliberately serial. The dev server is the bottleneck, not the browser,
  // and a flaky parallel run teaches people to ignore red.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  timeout: 20_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // A React app is usable at DOMContentLoaded; waiting for `load` waits for
    // every font and image and turns a slow asset into a failed test.
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" },
      },
    },
  ],

  /**
   * The built bundle, not the dev server.
   *
   * Two reasons. Vite dev compiles each route the first time it is requested,
   * which made navigations time out and turned a smoke suite into a test of
   * compiler latency. And the thing that broke was the build — checking the
   * artifact people actually deploy is the point.
   *
   * `npm run build` now type-checks first, so a type error fails the suite
   * before a browser opens.
   */
  webServer: {
    command: "npm run build && npx vite preview --port 5173 --host 127.0.0.1 --strictPort",
    url: "http://127.0.0.1:5173",
    // Never reuse. A dev server left running on this port meant the suite
    // silently tested Vite's on-demand compilation instead of the built
    // bundle, which is the artifact that actually ships — so 20 tests passed
    // against something nobody deploys.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
