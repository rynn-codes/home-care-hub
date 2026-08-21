import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * Reports.
 *
 * The property worth holding in a browser is the one a unit test cannot see:
 * that a report Joy cannot compute LOOKS different from one it can. The page
 * this replaced had four charts reading mock data, and they were indis-
 * tinguishable from real ones — which is a worse failure on a reports page than
 * anywhere else, because a reports page is where somebody goes specifically to
 * be told a number they will act on.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("reports", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
    await page.goto("/reports");
  });

  test("has the six reports and the period selector", async ({ page }) => {
    const log = watchForErrors(page);
    const nav = page.getByRole("navigation", { name: "Reports" });

    for (const name of [
      "Revenue by month",
      "Hours by service",
      "Caregiver utilisation",
      "Net margin by client",
      "Unbillable hours",
      "Outstanding invoices",
    ]) {
      await expect(nav.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
    }

    for (const period of ["Week", "Month", "Last month", "Quarter"]) {
      await expect(page.getByRole("button", { name: period, exact: true })).toBeVisible();
    }
    expect(log.errors).toEqual([]);
  });

  test("says what is missing instead of printing a plausible number", async ({ page }) => {
    // Net margin is the most decision-shaped figure here — somebody prices a
    // contract off it — and Joy has neither client rates nor pay rates.
    await page
      .getByRole("navigation", { name: "Reports" })
      .getByRole("button", { name: /^Net margin/ })
      .click();

    await expect(page.locator("main")).toContainText("Joy cannot produce this yet");
    await expect(page.locator("main")).toContainText("cost side");
    // And nothing that could be mistaken for a result.
    await expect(page.locator("main table")).toHaveCount(0);
  });

  test("marks the reports it cannot produce in the list, not only when opened", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Reports" });
    await expect(nav.getByRole("button", { name: /Cannot be produced yet/ })).toHaveCount(2);
  });

  test("has no authorisation report, because Joy has no payers", async ({ page }) => {
    // Karynn, 21 August: "We are all private pay... We don't need anything
    // regarding authorizations." Asserted rather than simply deleted, so it
    // does not quietly come back with the next design that shows six slots.
    await expect(page.locator("main")).not.toContainText(/authoris|authoriz/i);
  });

  test("computes the ones it can from the real schedule", async ({ page }) => {
    const log = watchForErrors(page);
    await page
      .getByRole("navigation", { name: "Reports" })
      .getByRole("button", { name: /^Hours by service/ })
      .click();

    await expect(page.locator("main")).toContainText("hours delivered");
    await expect(page.locator("main table")).toBeVisible();
    // Karynn, 21 August: the service label is billing and scheduling, not a
    // description of what the caregiver does.
    await expect(page.locator("main")).toContainText("does not separate care");
    expect(log.errors).toEqual([]);
  });

  test("outstanding invoices name the oldest debt, not just the total", async ({ page }) => {
    // Joy is all private pay: every dollar owed is a family, and nothing
    // arrives on its own. The total alone is the number that gets glanced at
    // and forgotten; the age is the one that gets acted on.
    const log = watchForErrors(page);
    await page
      .getByRole("navigation", { name: "Reports" })
      .getByRole("button", { name: /^Outstanding/ })
      .click();

    await expect(page.locator("main")).toContainText(/outstanding/i);
    await expect(page.locator("main")).toContainText(/oldest by \d+ days/);
    await expect(page.locator("main")).toContainText("Over 90 days");
    // An invoice Joy computed and never sent is not a debt.
    await expect(page.locator("main")).toContainText("actually sent");
    expect(log.errors).toEqual([]);
  });

  test("keeps a credit separate from money owed", async ({ page }) => {
    // A family who paid twice is owed money BY Joy. Netting it off against
    // somebody else's arrears is how it never gets returned.
    await page
      .getByRole("navigation", { name: "Reports" })
      .getByRole("button", { name: /^Outstanding/ })
      .click();
    await expect(page.locator("main")).toContainText(/credit Joy is holding/);
    await expect(page.locator("main")).toContainText(/money owed back, not netted off/);
  });

  test("changing the period changes the answer", async ({ page }) => {
    await page
      .getByRole("navigation", { name: "Reports" })
      .getByRole("button", { name: /^Hours by service/ })
      .click();

    const subtitle = page.locator("main h2 + p");
    const asMonth = await subtitle.textContent();

    await page.getByRole("button", { name: "Last month", exact: true }).click();
    await expect(subtitle).not.toHaveText(asMonth ?? "");
  });
});
