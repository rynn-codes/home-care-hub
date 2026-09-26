import { chromium } from "playwright";
const port = process.argv[3] ?? "8099";
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
const base = `http://localhost:${port}/index.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1380, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
const shot = (name) => page.screenshot({ path: `${out}/${name}-${port}.png`, fullPage: true });

// Same action twice in a row on its own screen.
await page.goto(`${base}#/admissions`);
await page.waitForTimeout(700);
for (let i = 0; i < 2; i++) {
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "New Client" }).click();
  await page.waitForTimeout(700);
  console.log(`New Client on Admissions, try ${i + 1}:`, (await page.locator("[role=dialog]").count()) > 0 ? "OPEN" : "NOTHING");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

// Add a signer text box to one request, without touching the template.
await page.goto(`${base}#/documents/signing/new`);
await page.waitForTimeout(900);
await page.selectOption("#req-client", { label: "Jessie C" });
await page.waitForTimeout(1800);
await page.getByRole("tab", { name: "Add or move boxes" }).click();
await page.getByRole("button", { name: "Text", exact: true }).click();
await page.waitForTimeout(300);
await page.fill("#fld-label", "Emergency contact name and phone");
await page.selectOption("#fld-fill", "signer");
await page.getByLabel("Required before signing").check();
// Drag the new box down to the blank area under the services line.
const box = page.locator("[data-field-kind='text']").first();
const bb = await box.boundingBox();
await page.mouse.move(bb.x + 10, bb.y + 8);
await page.mouse.down();
await page.mouse.move(bb.x + 120, bb.y + 330, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(300);
await shot("rq-1-add-box");
await page.getByRole("button", { name: "Send", exact: true }).click();
await page.waitForTimeout(1200);
const id = page.url().split("/").pop();
await shot("rq-2-sent");

// Template unchanged?
await page.goto(`${base}#/documents/signing`);
await page.waitForTimeout(800);
console.log("template boxes:", await page.locator("text=/\\d+ boxes/").first().textContent());

// The family sees the extra box and must fill it.
await page.goto(`${base}#/portal/login`);
await page.waitForTimeout(700);
await page.fill("#portal-phone", "7135550110");
await page.getByRole("button", { name: "Send code" }).click();
await page.waitForTimeout(600);
const note = await page.locator("text=The text Joy would have sent").textContent();
await page.locator("input").last().focus();
await page.keyboard.type((note.match(/\d{4,8}/) ?? [""])[0]);
await page.waitForTimeout(900);
await page.goto(`${base}#/portal/care/sign/${id}`);
await page.waitForTimeout(2200);
await page.getByRole("button", { name: "Start" }).click();
await page.waitForTimeout(400);
await page.getByLabel("Emergency contact name and phone").fill("Susan C · (713) 555-0199");
await shot("rq-3-portal-fills");
await browser.close();
