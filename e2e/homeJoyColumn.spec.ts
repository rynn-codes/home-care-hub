import { expect, signInAsStaff, test, watchForErrors } from "./support";
import { HOME_JOY } from "../src/lib/homeSeed";

/**
 * Joy's column, and the two things Karynn found broken on 25 August:
 * "All of these should be links to somewhere. Also you're missing View Joy
 * Operations", and "Talk to Joy icon doesn't work."
 *
 * Every row is clicked for real here. A route table in a unit test proves the
 * strings match; only this proves the link renders, is reachable, and lands.
 */
const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("Joy's column on Home", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  for (const group of HOME_JOY) {
    for (const item of group.items) {
      test(`"${item.text}" goes somewhere`, async ({ page }) => {
        const log = watchForErrors(page);
        await page.goto("/");

        const column = page.getByRole("region", { name: "Joy Assistant" });
        await column.getByRole("link", { name: item.text }).click();

        // Landed, and landed on a real screen rather than the not-found page.
        await expect(page).toHaveURL(new RegExp(`${item.to.replace(/\//g, "\\/")}$`));
        await expect(page.locator("h1").first()).toBeVisible();
        expect(log.errors, `${item.text} logged errors`).toEqual([]);
      });
    }
  }

  test("View Joy Operations opens Joy Operations", async ({ page }) => {
    // This was missing from the column entirely.
    const log = watchForErrors(page);
    await page.goto("/");

    await page.getByRole("link", { name: "View Joy Operations" }).click();
    await expect(page).toHaveURL(/\/brain\/operations$/);

    // Not just the route — the Joy Operations tab is the one showing.
    await expect(page.getByRole("tab", { name: "Joy Operations" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(log.errors).toEqual([]);
  });

  test("shows all four of Joy's states", async ({ page }) => {
    await page.goto("/");
    const column = page.getByRole("region", { name: "Joy Assistant" });
    for (const word of ["Handled", "Working", "Waiting", "Needs you"]) {
      await expect(column.getByText(word, { exact: true })).toBeVisible();
    }
  });
});

test.describe("the top bar", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("has no notification bell", async ({ page }) => {
    // Karynn: "You can take off the notifications bell at the top. Don't need."
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Notifications" })).toHaveCount(0);
  });
});

test.describe("Talk to Joy", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("the heading and its mark open Joy", async ({ page }) => {
    // "Talk to Joy icon doesn't work" — it was decoration, so the thing on the
    // card that looked most like a button was the one thing that wasn't.
    const log = watchForErrors(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Talk to Joy" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(log.errors).toEqual([]);
  });

  test("a typed question still opens Joy carrying the question", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Ask Joy").fill("What is holding up payroll?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("dialog")).toContainText("What is holding up payroll?");
  });

  test("the send arrow does nothing on an empty box", async ({ page }) => {
    // Opening Joy with nothing typed is legitimate — that is what the heading
    // is for. Pressing send on an empty box is not.
    await page.goto("/");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
