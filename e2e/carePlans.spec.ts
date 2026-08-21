import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * The care plan, end to end.
 *
 * The failure this suite exists for is not a crash. Before the care plan module
 * there was no screen anywhere in Joy that could tell you a client was being
 * cared for with nothing written down: the caregiver's phone listed five
 * invented tasks for everybody, so a client whose plan had never been written
 * looked exactly like one whose plan was current. That is invisible in a unit
 * test and obvious the moment you open the two screens.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("care plans", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("Home names the clients who have no plan at all", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/");

    const tile = page.locator('a[href="/clients/care-plans"]').first();
    await expect(tile).toContainText("no plan at all");
    await tile.click();

    await expect(page.locator("h1")).toHaveText("Care plans");
    // Sorted so the unwritten plans are the first thing on the screen.
    await expect(page.locator("main li").first()).toContainText("No care plan");
    expect(log.errors).toEqual([]);
  });

  test("a change is reviewed before it can go live, and then replaces the old version", async ({
    page,
  }) => {
    const log = watchForErrors(page);
    await page.goto("/clients/care-plans");

    const card = page.locator("main li").filter({ hasText: "Dolores Vance" }).first();
    // Her headline is "running past its end date" — timed care outranks a
    // waiting revision, and both are true of her at once. What this test is
    // about is the revision flow, which is unchanged.
    await expect(card).toContainText("version 1");
    await expect(card.getByRole("button", { name: "Read the change" })).toBeVisible();

    // Reading the change shows the revision, labelled as one.
    await card.getByRole("button", { name: "Read the change" }).click();
    await expect(card).toContainText("Version 2");
    await expect(card).toContainText("replaces the version being followed today");

    // Nothing goes live on somebody's say-so; it is reviewed first.
    await expect(card.getByRole("button", { name: /^Put version/ })).toHaveCount(0);
    await card.getByRole("button", { name: "Mark reviewed" }).click();

    await card.getByRole("button", { name: "Put version 2 live" }).click();
    await expect(card).toContainText("version 2");
    await expect(card).toContainText("Current");
  });

  test("flags care that has run past the date the family agreed to", async ({ page }) => {
    // Karynn, 21 August: respite and post-surgical care is timed — "will be out
    // of the home in a month or after they recover". Timed care that quietly
    // continues is money and consent both: the visits keep being scheduled and
    // nobody has asked the family whether they still want them.
    const log = watchForErrors(page);
    await page.goto("/clients/care-plans");

    const card = page.locator("main li").filter({ hasText: "Dolores Vance" }).first();
    await expect(card).toContainText("Running past its end date");
    await expect(card).toContainText(/care was agreed to \d{4}-\d{2}-\d{2} and is still running/);
    await expect(card).toContainText("nobody wrote that down");
    expect(log.errors).toEqual([]);
  });

  test("a caregiver whose client has no plan is told so, not given invented tasks", async ({
    page,
  }) => {
    // The whole point, from the other side of the app.
    const log = watchForErrors(page);
    await page.goto("/clients/care-plans");
    await expect(page.locator("main li").filter({ hasText: "Ruth Alvarez" }).first()).toContainText(
      "no care plan",
    );
    expect(log.errors).toEqual([]);
  });
});
