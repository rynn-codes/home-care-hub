import { test as base, type Page } from "@playwright/test";

/**
 * Shared helpers.
 *
 * `watchForErrors` is the one that matters. Every spec attaches it, and a page
 * error or a console error fails the test — which is exactly what a blank white
 * screen looks like from the outside.
 */

/**
 * Every spec uses this `test` rather than Playwright's, so external requests
 * are blocked for all of them.
 *
 * The reason is not tidiness. `index.html` pulls a render-blocking stylesheet
 * from fonts.googleapis.com, and in an environment without egress that request
 * hangs until it resets — so the `load` event does not fire, and a navigation
 * times out on a page that is otherwise perfectly fine. That cost three
 * failures that looked like application bugs and were not.
 *
 * Blocking is also the right default on its own terms: a test suite that
 * depends on a third party's CDN being reachable is a suite that goes red when
 * somebody else has an outage.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
    await use(page);
  },
});

export { expect } from "@playwright/test";

export interface ErrorLog {
  errors: string[];
}

/** React and Vite noise that is not a defect. */
const IGNORED = [
  // The demo has no Supabase project reachable from a test run.
  "Failed to load resource",
  "net::ERR",
  "ERR_CONNECTION_REFUSED",
];

export function watchForErrors(page: Page): ErrorLog {
  const log: ErrorLog = { errors: [] };

  page.on("pageerror", (e) => log.errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (IGNORED.some((ignore) => text.includes(ignore))) return;
    log.errors.push(`console: ${text}`);
  });

  return log;
}

/**
 * Put a session in local storage so the admin shell renders.
 *
 * The guard this satisfies is `RequireAuth`, which only checks that Supabase
 * reports a session. It is not the security boundary — that is row level
 * security — so faking it here tests the screens without pretending to test
 * authorization. The database policy suites cover that, as `authenticated`.
 */
export async function signInAsStaff(page: Page, projectRef: string) {
  await page.addInitScript((ref) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: "e2e",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "e2e",
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "e2e@local",
      },
    }));
  }, projectRef);
}

/** Sign into the portal for real, through the OTP screen. */
export async function signInToPortal(page: Page, phone: string) {
  await page.goto("/portal/login", { waitUntil: "domcontentloaded" });
  await page.locator("#portal-phone").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();

  // No SMS provider is connected, so the prototype shows the code it generated.
  const sent = await page.locator("text=The text Joy would have sent").textContent();
  const code = sent?.match(/(\d{6})/)?.[1];
  if (!code) throw new Error("No demo code on screen — has the prototype notice been removed?");

  await page.locator("input[data-input-otp]").fill(code);
  await page.waitForURL(/\/portal\/(work|care|choose|closed)/);
}
