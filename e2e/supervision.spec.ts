import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * The annual supervisory visit, from overdue to recorded.
 *
 * The client record has shown this obligation counting down since the
 * compliance clock was written. What it could not do was anything about it:
 * nothing booked a visit, nothing recorded one, and nothing reset the clock, so
 * the row counted up from start of care forever. A compliance clock nobody can
 * stop is a clock people learn to ignore.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("supervisory visits", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("the nav reaches the screen that can actually do something about it", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/");

    // The approved dashboard mock keeps Home to the morning's work; the
    // supervision clock lives where it can be acted on, under Clients.
    await page.locator('nav a[href="/clients"]').first().click();
    const link = page.locator('a[href="/clients/supervision"]').first();
    await expect(link).toContainText("Supervision");
    await link.click();
    await expect(page.locator("h1")).toHaveText("Supervisory visits");
    expect(log.errors).toEqual([]);
  });

  test("an overdue client can be booked, and then stops asking", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/clients/supervision");

    const card = page.locator("main li").first();
    await expect(card).toContainText("overdue");

    await card.locator('input[type="date"]').fill("2026-09-04");
    await card.getByRole("button", { name: "Book it" }).click();

    await expect(card).toContainText("Booked for 2026-09-04");
    // §5: nobody is handed a task for a wait that is already being handled.
    await expect(card.getByRole("button", { name: "Book it" })).toHaveCount(0);
    expect(log.errors).toEqual([]);
  });

  test("recording a visit resets both clocks at once", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/clients/supervision");

    const card = page.locator("main li").filter({ hasText: "Edward Pham" }).first();
    await expect(card).toContainText("Booked for");
    await expect(card).toContainText("Care plan review due 2027-01-14");

    // Nothing is recorded without findings — a supervisory visit with none is a
    // date in a file and nothing else.
    const record = card.getByRole("button", { name: "Record the visit" });
    await expect(record).toBeDisabled();
    await expect(card).toContainText("A supervisory visit with no findings");

    await card
      .getByLabel("What did you see?")
      .fill("Watched a transfer and the evening routine. Plan still fits.");
    await record.click();

    // The supervision clock restarted, and because the plan was reviewed on the
    // same trip its clock moved with it. The two disagreeing is exactly what
    // completing them together prevents.
    await expect(card).toContainText("last visit");
    await expect(card).not.toContainText("Care plan review due 2027-01-14");
    expect(log.errors).toEqual([]);
  });
});
