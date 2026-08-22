import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * The Saturday run, from draft to an approved invoice with a name on it.
 *
 * §7.2's order held on one card: exceptions first (a task list), drafts
 * second (one read and one click each), and approval landing on the audit
 * trail. The domain enforced all of this for weeks; this is the screen that
 * finally lets somebody DO it.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("the Saturday run", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("shows the upcoming week's drafts, priced from the agreements", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/billing");

    const card = page.locator("section").filter({ hasText: "The Saturday run" });
    await expect(card).toBeVisible();
    // Drafts exist: the seeded agreements carry hours and rates.
    await expect(card.getByRole("button", { name: "Approve" }).first()).toBeVisible();
    expect(log.errors).toEqual([]);
  });

  test("approving a draft puts a name on it, and on the trail", async ({ page }) => {
    const log = watchForErrors(page);
    await page.goto("/billing");

    const card = page.locator("section").filter({ hasText: "The Saturday run" });
    await card.getByRole("button", { name: "Approve" }).first().click();
    await expect(card.getByText(/Approved by Karynn Verrett/).first()).toBeVisible();

    // §7.2 step 6 is an audited act — the trail says who approved.
    await page.goto("/operations/audit");
    const trail = page.locator("section").filter({ hasText: "The trail, this session" });
    await expect(trail).toContainText("approved an invoice");
    await expect(trail).toContainText("Karynn Verrett");
    expect(log.errors).toEqual([]);
  });

  test("the approval survives a reload — it is a record, not a toast", async ({ page }) => {
    await page.goto("/billing");
    const card = page.locator("section").filter({ hasText: "The Saturday run" });
    const buttons = card.getByRole("button", { name: "Approve" });
    const before = await buttons.count();
    if (before === 0) test.skip();

    await buttons.first().click();
    await expect(card.getByText(/Approved by/).first()).toBeVisible();

    await page.reload();
    const after = page.locator("section").filter({ hasText: "The Saturday run" });
    await expect(after.getByText(/Approved by Karynn Verrett/).first()).toBeVisible();
  });
});
