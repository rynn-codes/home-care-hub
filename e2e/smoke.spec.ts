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
  ["/operations/incidents", "Incidents"],
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

test.describe("a bad connection", () => {
  test("the app paints when the font host never answers", async ({ page }) => {
    // Not hypothetical. A render-blocking stylesheet link held the page until
    // Google replied; where nothing replied, the load event never fired and the
    // screen stayed white. On a caregiver's phone in a client's house that is
    // the difference between a slow app and no app.
    //
    // Every external request is already blocked for this suite, so this test
    // asserts the fix rather than simulating it: fonts are unreachable here by
    // construction, and the page must still come up.
    const log = watchForErrors(page);
    await signInAsStaff(page, PROJECT_REF);

    const started = Date.now();
    await page.goto("/", { waitUntil: "load" });
    await expect(page.locator("h1").first()).toBeVisible();

    // Generous, because this is a floor not a benchmark. Before the fix the
    // load event did not fire at all.
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(log.errors).toEqual([]);
  });

  test("text is readable in the fallback face", async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
    await page.goto("/");

    const family = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily);

    // The generic at the end must be sans-serif, not serif. (An earlier
    // version of this test asserted `not /serif$/`, which matches
    // "sans-serif" — the assertion was wrong, not the stack.)
    expect(family).toMatch(/sans-serif$/);

    // And there must be a real system face before it, so the first paint is a
    // UI font rather than whatever the browser defaults to.
    expect(family).toMatch(/system-ui|-apple-system|Segoe UI|Roboto/);
  });
});
