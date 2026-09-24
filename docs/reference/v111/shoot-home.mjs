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
for (const [route, name] of [["/", "home"], ["/brain", "brain"], ["/brain/my-work", "brain-my-work"], ["/brain/operations", "brain-operations"], ["/brain/calendar", "brain-calendar"], ["/brain/activity", "brain-activity"]]) {
  await page.goto(`${base}#${route}`);
  await page.waitForTimeout(900);
  await shot(name);
}
await browser.close();
