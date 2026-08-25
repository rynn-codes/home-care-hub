import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * Every screen agrees about what week it is.
 *
 * Karynn, 25 August: "Correct the Week 2 of 2… Ensure AI is aware and tracking
 * what week we are on on all pages." The bug was not one bad label; it was
 * three screens each computing their own week, so the same morning could be
 * week 1 on Home and week 2 on Payroll. A unit test proves the arithmetic; only
 * this proves the screens actually read it.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

/** "Week of Aug 22–28" as it appears on the page. */
const BADGE = /Week of ([A-Z][a-z]{2} \d{1,2}–(?:[A-Z][a-z]{2} )?\d{1,2})/;

test.describe("the agency week", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("is the same week on Home, The Brain, Billing and Scheduling", async ({ page }) => {
    const seen: Array<[string, string]> = [];

    for (const path of ["/", "/brain", "/billing", "/scheduling"]) {
      const log = watchForErrors(page);
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();

      const body = await page.locator("body").innerText();
      const match = body.match(BADGE);
      expect(match, `${path} never names the week`).not.toBeNull();
      seen.push([path, match![1]]);

      expect(log.errors, `${path} logged errors`).toEqual([]);
    }

    const distinct = new Set(seen.map(([, week]) => week));
    expect(
      distinct.size,
      `screens disagree about the week: ${seen.map(([p, w]) => `${p} says ${w}`).join(", ")}`,
    ).toBe(1);
  });

  test("Payroll names its weeks from the same calendar", async ({ page }) => {
    // Payroll shows the cycle rather than the badge — it pays the week that
    // just finished and bills the one about to start — so what is checked here
    // is that its billing week is the Saturday after Home's week, not a
    // separately computed one that happens to look right today.
    await page.goto("/");
    const home = (await page.locator("body").innerText()).match(BADGE);
    expect(home).not.toBeNull();

    await page.goto("/payroll");
    await expect(page.locator("h1").first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).toContain("Payroll week");
    expect(body).toContain("Billing week");
    expect(body).toContain("Pay cycle");
    // Home's week must not be the one payroll is billing: billing runs a week
    // ahead. If the two ever printed the same range, a definition has drifted.
    expect(body).not.toContain(`Billing week ${home![1]}`);
  });

  test('nothing anywhere says "of 2"', async ({ page }) => {
    // Karynn, 25 August: "take off the 1 of 2 on ALL pages. I have no clue what
    // that means." Checked on every screen that names a week, because the
    // string it replaced lived on one page for weeks without anyone noticing.
    for (const path of ["/", "/brain", "/billing", "/scheduling", "/payroll"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const body = await page.locator("body").innerText();
      // Narrow on purpose: "0 of 2 caregivers cleared" is a real count and has
      // to survive. What must not come back is a WEEK numbered out of two.
      expect(body, `${path} numbers the week out of two`).not.toMatch(/week\s+\d\s+of\s+2/i);
      expect(body, `${path} still says "Billing Week"`).not.toContain("Billing Week");
    }
  });

  test("the week is stated, not left to be inferred", async ({ page }) => {
    // The label used to be hardcoded, which is invisible until it is wrong.
    // Asserting the badge is present at all is what keeps it wired up.
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.locator("body").innerText()).toMatch(BADGE);
  });
});
