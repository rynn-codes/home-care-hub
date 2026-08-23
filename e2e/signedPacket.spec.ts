import { expect, signInAsStaff, test, watchForErrors } from "./support";

/**
 * The signed packet, rendered as the document it is.
 *
 * The record was always stored; nothing could SHOW it. This walks to a
 * seeded, already-signed session and opens the packet: every clause in full,
 * the decisions, the signature block, the witness — and the honesty line
 * saying a typed signature stands in and the generated document is a separate,
 * off integration.
 */

const PROJECT_REF = process.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";

test.describe("the signed packet", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsStaff(page, PROJECT_REF);
  });

  test("renders the record: clauses, decisions, signature, witness", async ({ page }) => {
    const log = watchForErrors(page);

    // adm-robert is seeded at ready_for_admission: assessment complete,
    // packet signed by the responsible party, everything agreed except
    // transportation — a real restriction, not a clean sheet.
    await page.goto("/admissions/adm-robert/review");
    await page.goto("/admissions/adm-robert/assessment");
    await page.getByRole("button", { name: /Review consents with/ }).click();

    // Already signed, so the flow lands on done — with the packet one click away.
    await page.getByRole("button", { name: "View the signed packet" }).click();

    const packet = page.locator(".signed-packet");
    await expect(packet).toContainText("Joy Healthcare Services, LLC");
    await expect(packet).toContainText("signed record");
    // The corrected agreement's own sentence, in full text on the page.
    await expect(packet).toContainText("will invoice every week in advance");
    // The declined consent shows as declined — the packet records a no.
    await expect(packet).toContainText("Declined");
    // The signature block: signer, witness, and the honesty line.
    await expect(packet).toContainText("Responsible party");
    await expect(packet).toContainText("Karynn Verrett");
    await expect(packet).toContainText("typed signature stands in");

    await packet.getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".signed-packet")).toHaveCount(0);
    expect(log.errors).toEqual([]);
  });
});
