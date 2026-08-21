import AxeBuilder from "@axe-core/playwright";
import { expect, signInAsStaff, signInToPortal, test } from "./support";

/**
 * Who actually reads these screens.
 *
 * The family portal is opened by somebody's daughter, and often by somebody's
 * husband, who may be eighty. The employee portal is used one-handed, outdoors,
 * on a phone, by caregivers who are frequently on their feet for twelve hours.
 * The admin app is used all day by one person.
 *
 * None of that is unusual for home care, and all of it makes the ordinary
 * accessibility failures — unlabelled controls, contrast a tired eye cannot
 * resolve, a focus order that traps somebody on a keyboard — worse here than on
 * a marketing site.
 *
 * WCAG 2.1 AA is the bar, which is also the bar a healthcare organisation is
 * expected to meet. `withTags` restricts axe to the rules that map to it rather
 * than everything axe knows, so a failure means a standard was missed rather
 * than a preference was.
 *
 * Automated checks catch perhaps a third of what matters. They do not know
 * whether a label makes sense or whether an error is findable. This is a floor.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Wait for the page to stop moving before measuring it.
 *
 * `AppShell` wraps every admin screen in `animate-fade-in`, and axe computes
 * contrast from the colours actually on screen — so a scan that starts during
 * the fade measures the blend, not the design. That is how this suite reported
 * muted-foreground at 4.2:1 when the settled value is 5.38:1: a real-looking
 * failure with no defect behind it, on seven screens at once.
 *
 * It is a timing bug and it cuts both ways. A page that faded in a little
 * faster would have passed the same scan, so the suite was never measuring what
 * it claimed to. Waiting for every animation to finish makes the result depend
 * on the stylesheet rather than on how busy the machine is.
 *
 * Deliberately waiting rather than disabling animations: this tests the page a
 * person actually gets, and an animation that never finishes is itself worth
 * failing on.
 */
async function settle(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((a) => a.playState === "finished" || a.playState === "idle"),
    undefined,
    { timeout: 5_000 },
  );
}

async function scan(page: import("@playwright/test").Page) {
  await settle(page);
  return new AxeBuilder({ page }).withTags(WCAG).analyze();
}

/** Readable when a violation fails a test. A count alone is not actionable. */
function describeViolations(results: Awaited<ReturnType<typeof scan>>): string {
  return results.violations
    .map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.help}\n    ${v.nodes[0]?.target}`)
    .join("\n  ");
}

test.describe("the admin app", () => {
  for (const [path, name] of [
    ["/", "Home"],
    ["/operations", "Operations"],
    ["/operations/portal", "Portal activity"],
    ["/operations/incidents", "Incidents"],
    ["/clients", "Clients"],
    ["/clients/care-plans", "Care plans"],
    ["/clients/supervision", "Supervision"],
    ["/people", "People"],
    ["/payroll", "Payroll"],
    ["/billing", "Billing"],
  ] as Array<[string, string]>) {
    test(`${name} meets WCAG 2.1 AA`, async ({ page }) => {
      await signInAsStaff(page, PROJECT_REF);
      await page.goto(path);
      await page.locator("h1").first().waitFor();

      const results = await scan(page);
      expect(results.violations, `\n  ${describeViolations(results)}\n`).toEqual([]);
    });
  }
});

test.describe("the portals", () => {
  test("the sign-in screen meets WCAG 2.1 AA", async ({ page }) => {
    // The first thing a candidate or a family ever sees of Joy.
    await page.goto("/portal/login");
    await page.locator("h1").waitFor();

    const results = await scan(page);
    expect(results.violations, `\n  ${describeViolations(results)}\n`).toEqual([]);
  });

  test("the caregiver's portal meets WCAG 2.1 AA", async ({ page }) => {
    await signInToPortal(page, "7135550100");

    const results = await scan(page);
    expect(results.violations, `\n  ${describeViolations(results)}\n`).toEqual([]);
  });

  test("the family portal meets WCAG 2.1 AA", async ({ page }) => {
    await signInToPortal(page, "7135550110");

    const results = await scan(page);
    expect(results.violations, `\n  ${describeViolations(results)}\n`).toEqual([]);
  });

  test("the moments timeline meets WCAG 2.1 AA", async ({ page }) => {
    await signInToPortal(page, "7135550110");
    await page.goto("/portal/care/moments");
    await page.locator("h1").waitFor();

    const results = await scan(page);
    expect(results.violations, `\n  ${describeViolations(results)}\n`).toEqual([]);
  });
});

test.describe("using a phone one-handed", () => {
  test("every control in the portal is big enough to hit", async ({ page }) => {
    // WCAG 2.5.5 asks for 44×44. This is not pedantry on a screen somebody taps
    // while holding a door open: a miss-tap on the clock-in button is a visit
    // that starts late in the record.
    await page.setViewportSize({ width: 390, height: 844 });
    await signInToPortal(page, "7135550100");

    const small = await page
      .locator("button:visible, a:visible, input:visible")
      .evaluateAll((els) =>
        els
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName, text: (el.textContent || "").trim().slice(0, 40), h: Math.round(r.height), w: Math.round(r.width) };
          })
          // Inline links inside a sentence are exempt from 2.5.5; standalone
          // controls are not.
          .filter((m) => m.h > 0 && m.h < 44 && m.w > 60),
      );

    expect(small, `controls under 44px tall: ${JSON.stringify(small, null, 2)}`).toEqual([]);
  });
});
