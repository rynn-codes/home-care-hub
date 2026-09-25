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

// 1. Open the test document from its name.
await page.goto(`${base}#/documents`);
await page.waitForTimeout(900);
await page.getByRole("button", { name: "TEST - Mock Service Agreement", exact: true }).click();
await page.waitForTimeout(400);
await shot("prev-1-open");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// 2. Request a signature with no reason.
await page.locator("ul.m-0.list-none li button[aria-label^=\"More for TEST\"]").first().click();
await page.getByRole("menuitem", { name: "Request signature" }).click();
await page.waitForTimeout(400);
await page.selectOption("#sig-client", { label: "Jessie C" });
await shot("prev-2-dialog-no-reason");
await page.getByRole("button", { name: "Request signature" }).last().click();
await page.waitForTimeout(600);

// 3. Portal: read the document before signing.
await page.goto(`${base}#/portal/login`);
await page.waitForTimeout(700);
await page.fill("#portal-phone", "7135550110");
await page.getByRole("button", { name: "Send code" }).click();
await page.waitForTimeout(600);
const note = await page.locator("text=The text Joy would have sent").textContent();
await page.locator("input").last().focus();
await page.keyboard.type((note.match(/\d{4,8}/) ?? [""])[0]);
await page.waitForTimeout(900);
await page.goto(`${base}#/portal/care/documents`);
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Read the document" }).click();
await page.waitForTimeout(300);
await shot("prev-3-portal-read");
await browser.close();
