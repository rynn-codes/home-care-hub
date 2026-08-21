import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * The admission review screen, and §19's family-portal gate on it.
 *
 * Two things this catches that a unit test cannot. The board and the review
 * screen read different stores, so a record could say "Pre-Onboarding ·
 * assessment completed Aug 12" on one and "the in-person assessment has not
 * been completed yet" on the other — and it did. And §19's gate had nowhere to
 * be seen: the invitation card lived only on the client record, which does not
 * exist until after activation, which is the one point in the process where
 * §19 says the family should already have the portal.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("admission review", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("the review screen agrees with the stage on the board", async ({ page }) => {
    const log = watchForErrors(page);

    await page.goto("/admissions");
    const card = page.locator("main").getByText("Robert Green").first();
    await expect(card).toBeVisible();
    await expect(page.locator("main")).toContainText("Ready for Admission");

    await page.goto("/admissions/adm-robert/review");
    await expect(page.locator("main, body").first()).toContainText("25 of 25 decided");
    await expect(page.locator("main, body").first()).toContainText(
      "One signature and one set of initials on file",
    );
    expect(log.errors).toEqual([]);
  });

  test("an admission that has moved forward can invite the family", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/admissions/adm-susan-m/review");

    const card = page.locator("div").filter({ hasText: "Family portal" }).last();
    // The number came from the intake rather than being asked for again.
    await expect(card).toContainText("Joy will text (713) 555-0143");
    await expect(card.getByRole("button", { name: "Send portal link" })).toBeEnabled();
    expect(log.errors).toEqual([]);
  });

  test("one that has not is refused with a sentence, not an error", async ({ page }) => {
    // §19's refusals are normal states for an admission to be in. A red error
    // would make an ordinary Tuesday look like a problem.
    const log = watchForErrors(page);
    await page.goto("/admissions/adm-marcus/review");

    const card = page.locator("div").filter({ hasText: "Family portal" }).last();
    await expect(card).toContainText("The in-person assessment has not been completed yet");
    await expect(card.getByRole("button", { name: "Send portal link" })).toBeDisabled();
    expect(log.errors).toEqual([]);
  });
});
