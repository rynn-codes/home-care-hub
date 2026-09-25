import { chromium } from "playwright";
import fs from "node:fs";
const port = process.argv[3] ?? "8097";
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
fs.mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/index.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1380, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
const shot = (name) => page.screenshot({ path: `${out}/${name}-${port}.png`, fullPage: true });

// 1. Documents: ask Jessie C to sign the first file.
await page.goto(`${base}#/documents`);
await page.waitForTimeout(900);
const menu = page.locator("ul.m-0.list-none li button[aria-label^=\"More for\"]").first();
const fileName = (await menu.getAttribute("aria-label")).replace("More for ", "");
await menu.click();
await page.getByRole("menuitem", { name: "Request signature" }).click();
await page.waitForTimeout(400);
await page.selectOption("#sig-client", { label: "Jessie C" });
await page.fill("#sig-reason", "The updated plan of care needs a signature before Monday.");
await shot("sig-1-dialog");
await page.getByRole("button", { name: "Request signature" }).last().click();
await page.waitForTimeout(600);
await shot("sig-2-documents");

// 2. The client record shows it pending.
await page.goto(`${base}#/clients/c-jessie?tab=Docs`);
await page.waitForTimeout(900);
await shot("sig-3-record-pending");

// 3. The family signs in and signs it.
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
await shot("sig-4-portal-to-sign");
await page.getByRole("button", { name: "Sign", exact: true }).click();
await page.waitForTimeout(300);
await page.fill('input[id^="typed-"]', "Jessie C");
const box = await page.getByRole("img", { name: /Signature box/ }).boundingBox();
await page.mouse.move(box.x + 30, box.y + 80);
await page.mouse.down();
for (let i = 0; i < 40; i++) await page.mouse.move(box.x + 30 + i * 8, box.y + 80 + Math.sin(i / 3) * 30);
await page.mouse.up();
await page.waitForTimeout(200);
await shot("sig-5-portal-signing");
await page.getByRole("button", { name: /^Sign / }).click();
await page.waitForTimeout(600);
await shot("sig-6-portal-signed");

// 4. Back on the record: signed.
await page.goto(`${base}#/clients/c-jessie?tab=Docs`);
await page.waitForTimeout(900);
await shot("sig-7-record-signed");
await page.goto(`${base}#/reports/audit`);
await page.waitForTimeout(900);
await shot("sig-8-audit");
console.log("file:", fileName);
await browser.close();
