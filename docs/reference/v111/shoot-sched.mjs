import { chromium } from "playwright";
import fs from "node:fs";

// Rebuilt Scheduling against the local dist on 8097 (pass 8098 for V111).
const port = process.argv[3] ?? "8097";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const base = `http://localhost:${port}/index.html`;
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
fs.mkdirSync(out, { recursive: true });
const shot = (name) => page.screenshot({ path: `${out}/${name}-${port}.png`, fullPage: true });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

await page.goto(`${base}#/scheduling`);
await page.waitForTimeout(1500);
await shot("scheduling");
await page.getByRole("tab", { name: "agenda" }).click();
await page.waitForTimeout(600);
await shot("scheduling-agenda");
await page.getByRole("tab", { name: "calendar" }).click();
await page.waitForTimeout(300);
// Open the first visit card.
await page.locator('[role="button"][draggable="true"]').first().click();
await page.waitForTimeout(700);
await shot("scheduling-visit");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Quick Add" }).click();
await page.getByRole("menuitem", { name: "New shift" }).click();
await page.waitForTimeout(500);
await shot("scheduling-new-shift");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Quick Add" }).click();
await page.getByRole("menuitem", { name: "Build coverage" }).click();
await page.waitForTimeout(600);
await shot("scheduling-coverage");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Quick Add" }).click();
await page.getByRole("menuitem", { name: "Request off" }).click();
await page.waitForTimeout(400);
await shot("scheduling-request-off");

await browser.close();
