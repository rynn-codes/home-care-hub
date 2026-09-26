import { chromium } from "playwright";
import fs from "node:fs";
const port = process.argv[3] ?? "8099";
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
fs.mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/index.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
const shot = (name) => page.screenshot({ path: `${out}/${name}-${port}.png`, fullPage: true });

await page.goto(`${base}#/reports`);
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Quarter" }).click();
await page.waitForTimeout(400);
await shot("rp-1-revenue-summary");
await page.getByRole("button", { name: "Payments received" }).click();
await page.waitForTimeout(300);
await shot("rp-2-payments");
await page.getByRole("button", { name: "Investor share" }).click();
await page.waitForTimeout(300);
await shot("rp-3-investor-unset");

// Set the investor share in Settings → Agency.
await page.goto(`${base}#/settings`);
await page.waitForTimeout(800);
await page.getByRole("tab", { name: "Agency" }).click();
await page.waitForTimeout(400);
await page.fill("#investor-name", "R. Investor");
await page.fill("#investor-email", "investor@example.com");
await page.fill("#investor-percent", "10");
await page.waitForTimeout(300);
await page.locator("#investor-name").scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/rp-4-settings-${port}.png` });

await page.goto(`${base}#/reports`);
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Quarter" }).click();
await page.getByRole("button", { name: "Investor share" }).click();
await page.waitForTimeout(300);
await shot("rp-5-investor-share");
await page.getByRole("button", { name: "Payroll cost" }).click();
await page.waitForTimeout(300);
await shot("rp-6-payroll-cost");
await page.getByRole("button", { name: "Credits, write-offs and refunds" }).click();
await page.waitForTimeout(300);
await shot("rp-7-adjustments");

await page.goto(`${base}#/reports/investor`);
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Record as sent" }).click();
await page.waitForTimeout(600);
await shot("rp-8-investor-report");
await browser.close();
