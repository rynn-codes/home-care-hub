import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * The incident workflow, driven the way the office would drive it.
 *
 * The reason this suite exists rather than another unit test: the unit tests
 * prove the rules, and the rules were never the risk. The risk is that an
 * incident is reported at clock-out and then sits — because nothing put it in
 * front of anybody, or because the screen let somebody close it while a
 * notification was still outstanding. Both of those are failures of the page,
 * not of the engine, so they have to be checked in a browser.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("incidents", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("The Brain sends somebody to the incident that is past a deadline", async ({ page }) => {
    // The Brain is where this gets noticed or does not. It was Home until the
    // August rebuild moved the signal board off the morning screen; the point
    // stands, which is that a missed reporting deadline is one click from the
    // screen a person opens the day on.
    const log = watchForErrors(page);
    await page.goto("/brain");

    await page.getByRole("button", { name: "See why" }).click();
    const drawer = page.getByRole("dialog", { name: "Behind the brief" });
    const tile = drawer.locator('a[href="/operations/incidents"]').first();
    await expect(tile).toContainText("past a deadline");
    await tile.click();

    await expect(page.locator("h1")).toHaveText("Incidents");
    expect(log.errors).toEqual([]);
  });

  test("an unclassified incident cannot be classified without a decision on both questions", async ({
    page,
  }) => {
    const log = watchForErrors(page);
    await page.goto("/operations/incidents");

    const card = page.locator("li").filter({ hasText: "Dolores Vance" }).first();
    const classify = card.getByRole("button", { name: "Classify", exact: true });

    // Nothing chosen: no kind, and — deliberately — no default severity.
    await expect(classify).toBeDisabled();

    await card.getByRole("button", { name: "Fall", exact: true }).click();
    await expect(classify).toBeDisabled();

    await card.getByRole("button", { name: /^Minor/ }).click();
    await expect(classify).toBeEnabled();

    await classify.click();

    // Classifying is what works out who has to be told; before it, nobody was.
    await expect(card).toContainText(/who has to be told/i);

    // And the deadlines run from when the caregiver reported it, not from when
    // the office got round to classifying it — so a fall reported five hours
    // ago is already late the moment it is classified. That is the point.
    await expect(card).toContainText(/should have been told by now/);
    expect(log.errors).toEqual([]);
  });

  test("an incident cannot be closed while somebody still has to be told", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/operations/incidents");

    const card = page.locator("li").filter({ hasText: "Edward Pham" }).first();
    const close = card.getByRole("button", { name: "Close incident" });

    await card.getByLabel("What did you find?").fill("Dose missed; RN reviewing the MAR.");
    await expect(close).toBeDisabled();
    await expect(card).toContainText("Somebody still has to be told");

    // Tell everyone, and only then does closing become possible. Clicked one
    // at a time against a fresh locator, because recording a notification
    // re-renders the card and a snapshot of the buttons goes stale.
    const outstanding = card.getByRole("button", { name: "Mark told" });
    for (let remaining = await outstanding.count(); remaining > 0; remaining--) {
      await outstanding.first().click();
      await expect(outstanding).toHaveCount(remaining - 1);
    }

    // Still not closeable. A medication error needs an RN to see the client —
    // Karynn, 21 August — and every call being made is not that.
    await expect(close).toBeDisabled();
    await expect(card).toContainText("An RN still has to see the client");

    await card.getByLabel("What did the nurse find?").fill("Seen at home. Alert, no ill effects.");
    await card.getByRole("button", { name: "Record the visit" }).click();
    await expect(close).toBeEnabled();

    await close.click();
    await expect(card).not.toContainText("Somebody still has to be told");
    expect(log.errors).toEqual([]);
  });

  test("the page says the deadlines are Joy's policy and not a legal citation", async ({ page }) => {
    // This one is not decoration. Joy has not confirmed these windows against
    // the Texas requirements for its licence category, and a screen that shows
    // a countdown without saying where the number came from reads as though
    // somebody checked.
    await page.goto("/operations/incidents");
    await expect(page.locator("body")).toContainText("need checking against the current Texas");
  });
});
