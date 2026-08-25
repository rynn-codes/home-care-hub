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

/** "Aug 22–28 · Billing Week 1 of 2" as it appears on the page. */
const BADGE = /([A-Z][a-z]{2} \d{1,2}–(?:[A-Z][a-z]{2} )?\d{1,2}) · Billing Week ([12]) of 2/;

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
      seen.push([path, `${match![1]} · week ${match![2]}`]);

      expect(log.errors, `${path} logged errors`).toEqual([]);
    }

    const distinct = new Set(seen.map(([, week]) => week));
    expect(
      distinct.size,
      `screens disagree about the week: ${seen.map(([p, w]) => `${p} says ${w}`).join(", ")}`,
    ).toBe(1);
  });

  test("Payroll names the same half of the pay cycle", async ({ page }) => {
    // Payroll shows the cycle rather than the badge — it pays the week that
    // just finished — but the half it names has to match everyone else's.
    await page.goto("/");
    const home = (await page.locator("body").innerText()).match(BADGE);
    expect(home).not.toBeNull();

    await page.goto("/payroll");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(`week ${home![2]} of 2`)).toBeVisible();
  });

  test("the week is stated, not left to be inferred", async ({ page }) => {
    // The label used to be hardcoded, which is invisible until it is wrong.
    // Asserting the badge is present at all is what keeps it wired up.
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Billing Week 2 of 2\nBilling Week");
    expect(body).toMatch(BADGE);
  });
});
