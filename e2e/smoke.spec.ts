import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * Every screen comes up, and nothing shouts on the way.
 *
 * This is the suite that would have caught a missing import turning Home into
 * a blank white page — a failure the type checker missed at the time, the build
 * missed, and 648 unit tests missed, because none of them mount a route.
 *
 * Each route asserts three things and no more: the page did not error, the
 * console stayed quiet, and something rendered. Deliberately shallow. A smoke
 * suite that also checks copy becomes a suite people delete when the copy
 * changes, and then nothing checks that the page comes up at all.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

const ADMIN_ROUTES: Array<[string, string]> = [
  ["/", "Home"],
  ["/operations", "Operations"],
  ["/operations/hiring", "Hiring"],
  ["/operations/portal", "Portal activity"],
  ["/admissions", "Admissions"],
  ["/clients", "Clients"],
  ["/employees", "Employees"],
  ["/people", "People"],
  ["/scheduling", "Scheduling"],
  ["/billing", "Billing"],
  ["/payroll", "Payroll"],
  ["/reports", "Reports"],
  ["/documents", "Documents"],
  ["/sops", "SOPs"],
  ["/settings", "Settings"],
];

test.describe("admin screens", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  for (const [path, name] of ADMIN_ROUTES) {
    test(`${name} renders`, async ({ page }) => {
      const log = watchForErrors(page);

      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();

      // A blank page has a body with nothing in it. This is the assertion the
      // white-screen bug would have failed.
      const text = (await page.locator("body").innerText()).trim();
      expect(text.length).toBeGreaterThan(40);

      expect(log.errors, `${name} logged errors`).toEqual([]);
    });
  }
});

test.describe("the front door", () => {
  test("an unauthenticated visitor is sent to sign in", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/payroll");
    await expect(page).toHaveURL(/\/login/);
    expect(log.errors).toEqual([]);
  });

  test("an unknown path does not blow up", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/nothing-here");
    await expect(page.locator("body")).toContainText(/404|not found/i);

    // NotFound logs the attempted path on purpose — that is telemetry, not a
    // defect, so it is asserted rather than forbidden. Silencing it in the
    // shared ignore list would have hidden real 404s from every other test.
    expect(log.errors).toEqual([
      expect.stringContaining("non-existent route: /nothing-here"),
    ]);
  });
});
