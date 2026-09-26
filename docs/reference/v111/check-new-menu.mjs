import { chromium } from "playwright";
const port = process.argv[2] ?? "8099";
const base = `http://localhost:${port}/index.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1380, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

const screens = ["/", "/brain", "/documents", "/documents/signing", "/clients/c-pamela", "/employees", "/people", "/scheduling", "/billing", "/payroll", "/reports", "/reports/investor", "/admissions", "/hiring", "/settings", "/sops"];
const actions = ["New Client", "New Employee", "Schedule Shift", "New Assessment", "Add Task"];
const bad = [];
for (const screen of screens) {
  for (const action of actions) {
    await page.goto(`${base}#${screen}`);
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("menuitem", { name: action }).click();
    await page.waitForTimeout(900);
    const dialog = page.locator("[role=dialog]").last();
    const open = (await dialog.count()) > 0 && (await dialog.isVisible());
    const title = open ? ((await dialog.locator("h2, h3, [id$=title]").first().textContent().catch(() => "")) ?? "").trim().slice(0, 50) : "";
    const url = page.url().split("#")[1];
    console.log(`${screen.padEnd(22)} ${action.padEnd(16)} → ${url.padEnd(14)} ${open ? "OPEN  " + title : "NOTHING OPENED"}`);
    if (!open) bad.push(`${screen} → ${action}`);
    // Close whatever opened so the next round starts clean.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}
console.log("\nFailures:", bad.length, bad);
await browser.close();
