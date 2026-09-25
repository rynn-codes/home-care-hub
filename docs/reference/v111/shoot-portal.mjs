import { chromium } from "playwright";
import fs from "node:fs";
const port = process.argv[3] ?? "8097";
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
fs.mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/index.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function signIn(page, phone) {
  await page.goto(`${base}#/portal/login`);
  await page.waitForTimeout(700);
  await page.fill("#portal-phone", phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.waitForTimeout(600);
  const note = await page.locator("text=The text Joy would have sent").textContent();
  const code = (note.match(/\d{4,8}/) ?? [""])[0];
  await page.locator("input").last().focus();
  await page.keyboard.type(code);
  await page.waitForTimeout(900);
}

async function run(phone, routes, prefix) {
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", prefix, e.message));
  await signIn(page, phone);
  await page.screenshot({ path: `${out}/${prefix}-landing-${port}.png`, fullPage: true });
  for (const [route, name] of routes) {
    await page.goto(`${base}#${route}`);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${prefix}-${name}-${port}.png`, fullPage: true });
  }
  if (prefix === "work") {
    await page.goto(`${base}#/portal/work/schedule`);
    await page.waitForTimeout(600);
    const link = page.locator('a[href*="/portal/work/visit/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/work-visit-${port}.png`, fullPage: true });
    }
  }
  await ctx.close();
}

await run("7135550100", [["/portal/work", "home"], ["/portal/work/application", "application"], ["/portal/work/documents", "documents"], ["/portal/work/schedule", "schedule"]], "work");
await run("7135550120", [["/portal/work", "home"], ["/portal/work/schedule", "schedule"]], "renee");
await run("7135550110", [["/portal/care", "home"], ["/portal/care/moments", "moments"], ["/portal/care/documents", "documents"]], "family");
await browser.close();
