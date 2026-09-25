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
page.on("console", (m) => { if (m.type() === "error" && !/font|CERT|404/.test(m.text())) console.log("CONSOLE", m.text().slice(0, 200)); });
const shot = (name) => page.screenshot({ path: `${out}/${name}-${port}.png`, fullPage: true });

// 1. Signing home, then the template builder over the test agreement.
await page.goto(`${base}#/documents/signing`);
await page.waitForTimeout(1200);
await shot("sg-1-signing-home");
await page.getByRole("link", { name: "Edit boxes" }).first().click();
await page.waitForTimeout(2500);
await shot("sg-2-builder");
// Nudge a box to prove drag works: select the signature box and move it.
const box = page.locator("[data-field-kind='signature']").first();
const bb = await box.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2 - 40, bb.y + bb.height / 2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
const bb2 = await box.boundingBox();
console.log("drag moved box by", Math.round(bb2.x - bb.x));
// Put it back and add a Text box from the palette by clicking.
await page.mouse.move(bb2.x + bb2.width / 2, bb2.y + bb2.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
await page.mouse.up();
await page.getByRole("button", { name: "Text", exact: true }).click();
await page.waitForTimeout(300);
await shot("sg-3-builder-selected");
await page.getByRole("button", { name: "Remove this box" }).click();
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(800);

// 2. Send to sign: Pamela P, responsible party Gregory P.
await page.getByRole("button", { name: "Send to sign" }).click();
await page.waitForTimeout(800);
await page.selectOption("#req-client", { label: "Pamela P" });
await page.waitForTimeout(2000);
await shot("sg-4-send");
await page.getByRole("button", { name: "Send", exact: true }).click();
await page.waitForTimeout(1500);
await shot("sg-5-request-sent");
const url = page.url();
const envId = url.split("/").pop();
console.log("envelope", envId);

// 3. Client record shows it.
await page.goto(`${base}#/clients/c-pamela?tab=Docs`);
await page.waitForTimeout(1000);
await shot("sg-6-record");

// 4. The family signs. Portal grant 2 is Jessie's family; make a request for Jessie too so the portal has one.
await page.goto(`${base}#/documents/signing/new`);
await page.waitForTimeout(800);
await page.selectOption("#req-client", { label: "Jessie C" });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Send", exact: true }).click();
await page.waitForTimeout(1200);
const jessieId = page.url().split("/").pop();

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
await shot("sg-7-portal-list");
await page.goto(`${base}#/portal/care/sign/${jessieId}`);
await page.waitForTimeout(2500);
await shot("sg-8-portal-sign");
await page.getByRole("button", { name: "Start" }).click();
await page.waitForTimeout(500);
const pad = await page.getByRole("img", { name: /Signature box/ }).boundingBox();
await page.mouse.move(pad.x + 30, pad.y + 80);
await page.mouse.down();
for (let i = 0; i < 40; i++) await page.mouse.move(pad.x + 30 + i * 8, pad.y + 80 + Math.sin(i / 3) * 30);
await page.mouse.up();
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Finish and sign" }).click();
await page.waitForTimeout(1500);
await shot("sg-9-portal-signed");

// 5. Office countersigns and sends a copy.
await page.goto(`${base}#/documents/signing/${jessieId}`);
await page.waitForTimeout(2000);
await shot("sg-10-countersign");
const pad2 = await page.getByRole("img", { name: /Signature box/ }).boundingBox();
await page.mouse.move(pad2.x + 30, pad2.y + 60);
await page.mouse.down();
for (let i = 0; i < 30; i++) await page.mouse.move(pad2.x + 30 + i * 6, pad2.y + 60 + Math.cos(i / 3) * 20);
await page.mouse.up();
await page.getByRole("button", { name: "Countersign" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Send a copy" }).click();
await page.getByRole("button", { name: "Send", exact: true }).click();
await page.waitForTimeout(1200);
await shot("sg-11-completed");

// 6. Correct the Pamela one (void + reopen) and see the Brain.
await page.goto(`${base}#/documents/signing/${envId}`);
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Correct and resend" }).click();
await page.getByLabel("Reason").fill("Wrong start of care date");
await page.getByRole("button", { name: "Void and reopen" }).click();
await page.waitForTimeout(1200);
await shot("sg-12-corrected-draft");
await page.goto(`${base}#/documents/signing`);
await page.waitForTimeout(1200);
await shot("sg-13-signing-home-after");
await page.goto(`${base}#/reports/audit`);
await page.waitForTimeout(1200);
await shot("sg-14-audit");
await browser.close();
