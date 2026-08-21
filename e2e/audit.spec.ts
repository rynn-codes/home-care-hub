import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * The audit home, and the yearly incident report under it.
 *
 * Karynn asked whether there was a home for the audit portion. There was not:
 * Joy could build an audit packet for one employee, from inside that employee's
 * record, and nothing answered "show me your files" in one place. These tests
 * hold the two properties that make such a page worth having rather than
 * dangerous — every line links somewhere somebody can act, and the page refuses
 * to imply completeness it does not have.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("audit", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("answers a surveyor's questions and links each one somewhere", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/operations/audit");

    await expect(page.locator("main")).toContainText("Show me the personnel file");
    await expect(page.locator("main")).toContainText("Show me your incident log for the year");

    // A finding with nowhere to go is a complaint.
    const opens = page.locator("main").getByRole("link", { name: "Open" });
    expect(await opens.count()).toBeGreaterThan(4);
    expect(log.errors).toEqual([]);
  });

  test("names what it does not cover, rather than implying it is everything", async ({ page }) => {
    // The omissions are what make a green screen misleading, not the amber rows.
    await page.goto("/operations/audit");
    await expect(page.locator("main")).toContainText("What is not on this page");
    await expect(page.locator("main")).toContainText("Emergency preparedness");
  });

  test("records who did something, and says it in words", async ({ page }) => {
    // The writer and its rules existed and were tested for weeks, and nothing
    // in Joy ever called them. Eleven consequential actions — approving an
    // admission among them — left no record of who did them.
    const log = watchForErrors(page);

    await page.goto("/operations/audit");
    await expect(page.locator("main")).toContainText("Nothing yet");

    await page.goto("/admissions/adm-robert/review");
    await page.getByRole("button", { name: "Mark payment set up" }).click();
    await page.getByRole("button", { name: "Approve plan of care" }).click();
    await page.getByRole("button", { name: "Approve admission" }).click();

    await page.goto("/operations/audit");
    const trail = page.locator("section").filter({ hasText: "The trail, this session" });
    await expect(trail).toContainText("Karynn Verrett");
    await expect(trail).toContainText("approved the admission");
    await expect(trail).toContainText("adm-robert");
    expect(log.errors).toEqual([]);
  });

  test("still does not claim the trail is held, because nothing persists it", async ({ page }) => {
    // A trail in a browser is a real trail for a demo and not one a surveyor
    // could be shown. This is the line somebody would rely on without checking,
    // so the difference stays on the screen.
    await page.goto("/operations/audit");
    await expect(page.locator("main")).toContainText("not been applied");
    await expect(page.locator("main")).toContainText(/nothing is persisted/i);
  });

  test("the yearly report says what was missed, not just what happened", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/operations/audit");
    await page
      .locator("main li")
      .filter({ hasText: "incident log for the year" })
      .getByRole("link", { name: "Open" })
      .click();

    await expect(page.locator("h1")).toHaveText("Yearly incident report");
    await expect(page.locator("main")).toContainText("Somebody never told");
    await expect(page.locator("main")).toContainText("RN visits made on time");
    // Each line carries whether the obligations were met.
    await expect(page.locator("main")).toContainText(/never told|told late|Everyone told on time/);
    expect(log.errors).toEqual([]);
  });
});

test.describe("incidents, after Karynn's rules", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("an unclassified incident already owes the office a call", async ({ page }) => {
    // Before this, an incident reported at ten at night and unclassified until
    // morning carried no obligation to anybody at all.
    const log = watchForErrors(page);
    await page.goto("/operations/incidents");

    const card = page.locator("main li").filter({ hasText: "Dolores Vance" }).first();
    await expect(card).toContainText(/who has to be told/i);
    await expect(card).toContainText("The administrator");
    expect(log.errors).toEqual([]);
  });

  test("a fall cannot be closed on the phone call alone", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/operations/incidents");

    const card = page.locator("main li").filter({ hasText: "Dolores Vance" }).first();
    await card.getByRole("button", { name: "Fall", exact: true }).click();
    await card.getByRole("button", { name: /^Minor/ }).click();
    await card.getByRole("button", { name: "Classify", exact: true }).click();

    // Telling the RN is not a nurse looking at the client.
    await expect(card).toContainText(/rn visit/i);
    const outstanding = card.getByRole("button", { name: "Mark told" });
    for (let n = await outstanding.count(); n > 0; n--) {
      await outstanding.first().click();
      await expect(outstanding).toHaveCount(n - 1);
    }

    await card.getByLabel("What did you find?").fill("Rug edge, now taped down.");
    await expect(card.getByRole("button", { name: "Close incident" })).toBeDisabled();
    await expect(card).toContainText("An RN still has to see the client");

    await card.getByLabel("What did the nurse find?").fill("Seen at home. No injury.");
    await card.getByRole("button", { name: "Record the visit" }).click();
    await expect(card.getByRole("button", { name: "Close incident" })).toBeEnabled();
    expect(log.errors).toEqual([]);
  });
});
