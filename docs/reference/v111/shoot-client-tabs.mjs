import { chromium } from "playwright";
import fs from "node:fs";
const port = process.argv[3] ?? "8097";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const base = `http://localhost:${port}/index.html`;
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
fs.mkdirSync(out, { recursive: true });
const shot = (name) => page.screenshot({ path: `${out}/${name}-${port}.png`, fullPage: true });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
for (const [id, tab, name] of [["c-marilyn", "Schedule", "client-schedule"], ["c-pamela", "Services", "client-services"], ["c-charles", "Billing & Payments", "client-billing"]]) {
  await page.goto(`${base}#/clients/${id}`);
  await page.waitForTimeout(800);
  await page.getByRole("tab", { name: tab }).click();
  await page.waitForTimeout(700);
  await shot(name);
}
await browser.close();
