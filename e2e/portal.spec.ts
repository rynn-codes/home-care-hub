import { expect, signInToPortal, test, watchForErrors } from "./support";

/**
 * The portal flows, end to end through the real screens.
 *
 * These cover the paths a caregiver and a family actually take, and the
 * boundaries that matter: the login screen must not reveal whether a number is
 * known, and a workforce grant must not open the family portal.
 *
 * The demo phone numbers come from `lib/portalSeed.ts`.
 */

const CAREGIVER = "7135550100";   // onboarding
const FAMILY = "7135550110";      // pre-admission
const BOTH = "7135550120";        // holds two grants

test("an unknown number is answered exactly like a known one", async ({ page }) => {
  // The property this screen exists to hold. A different reply would turn the
  // login page into a way of asking whether somebody is a Joy client.
  const log = watchForErrors(page);

  await page.goto("/portal/login");
  await page.locator("#portal-phone").fill("7139999999");
  await page.getByRole("button", { name: "Send code" }).click();

  await expect(page.getByRole("heading", { name: /enter your code/i })).toBeVisible();
  await expect(page.getByText(/If that number is on file/)).toBeVisible();
  // …and no code, because nothing was sent.
  await expect(page.getByText("The text Joy would have sent")).toHaveCount(0);

  expect(log.errors).toEqual([]);
});

test("a caregiver signs in and reaches their own portal", async ({ page }) => {
  const log = watchForErrors(page);

  await signInToPortal(page, CAREGIVER);
  await expect(page).toHaveURL(/\/portal\/work/);
  await expect(page.locator("h1")).toContainText(/Jamisha/);

  expect(log.errors).toEqual([]);
});

test("a caregiver can reach their documents and is told what is needed", async ({ page }) => {
  const log = watchForErrors(page);

  await signInToPortal(page, CAREGIVER);
  await page.goto("/portal/work/documents");

  await expect(page.getByRole("heading", { name: "Your documents" })).toBeVisible();
  // Joy runs the background check; it must never appear as something to upload.
  await expect(page.getByText("Background check")).toHaveCount(0);

  expect(log.errors).toEqual([]);
});

test("holding two grants asks once, then remembers", async ({ page }) => {
  const log = watchForErrors(page);

  await signInToPortal(page, BOTH);
  await expect(page).toHaveURL(/\/portal\/choose/);

  await page.getByRole("button", { name: /Albert/ }).click();
  await expect(page).toHaveURL(/\/portal\/care/);

  // Signing in again resumes rather than asking, with the mode named.
  await signInToPortal(page, BOTH);
  await expect(page).toHaveURL(/\/portal\/care/);
  await expect(page.getByText("Joy · Albert's care")).toBeVisible();

  expect(log.errors).toEqual([]);
});

test("a family grant cannot open the workforce portal", async ({ page }) => {
  const log = watchForErrors(page);

  await signInToPortal(page, FAMILY);
  await page.goto("/portal/work/documents");

  // Sent back where they belong, not to a picker with one option.
  await expect(page).toHaveURL(/\/portal\/care/);

  expect(log.errors).toEqual([]);
});

test("the family portal shows the admission and never a staffing gap", async ({ page }) => {
  const log = watchForErrors(page);

  await signInToPortal(page, FAMILY);
  await expect(page.locator("h1")).toContainText("Susan");
  await expect(page.getByText("Start of care")).toBeVisible();

  // §24. An unstaffed visit reads as scheduled and nothing more.
  await expect(page.getByText(/unassigned|seeking cover|no caregiver/i)).toHaveCount(0);

  expect(log.errors).toEqual([]);
});
