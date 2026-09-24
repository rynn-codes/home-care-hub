import { chromium } from "playwright";
import fs from "node:fs";

// Rebuilt Clients / People / Admissions against the local dist on 8097.
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const base = "http://localhost:8097/index.html";
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
fs.mkdirSync(out, { recursive: true });
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });

await page.goto(`${base}#/clients`);
await page.waitForTimeout(1200);
await shot("clients");
await page.locator("table tbody tr").first().click();
await page.waitForTimeout(600);
await shot("clients-peek");
await page.keyboard.press("Escape");
await page.goto(`${base}#/clients/c-marilyn`);
await page.waitForTimeout(900);
await shot("client-profile");
await page.getByRole("tab", { name: "Activity" }).click();
await page.waitForTimeout(400);
await shot("client-activity");

await page.goto(`${base}#/people`);
await page.waitForTimeout(900);
await shot("people");
await page.locator("table tbody tr").first().click();
await page.waitForTimeout(700);
await shot("people-record");

await page.goto(`${base}#/admissions`);
await page.waitForTimeout(900);
await shot("admissions");
await page.getByRole("button", { name: "board" }).click();
await page.waitForTimeout(500);
await shot("admissions-board");
await page.getByRole("button", { name: "list" }).click();
await page.getByRole("button", { name: "Quick add" }).click();
await page.getByRole("menuitem", { name: "New lead" }).click();
await page.waitForTimeout(500);
await shot("admissions-new-lead");

await page.goto(`${base}#/hiring`);
await page.waitForTimeout(900);
await shot("hiring");

await browser.close();
