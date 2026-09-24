import { chromium } from "playwright";
import fs from "node:fs";

// Screenshot every screen of the V111 reference build, desktop width, full page.
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
const base = "http://localhost:8098/index.html";
const out = "/home/claude/home-care-hub/docs/reference/v111/screens";
fs.mkdirSync(out, { recursive: true });

const routes = [
  "/", "/brain", "/brain/my-work", "/brain/operations",
  "/scheduling", "/billing", "/payroll",
  "/clients", "/employees", "/people", "/admissions", "/hiring",
  "/reports", "/reports/audit", "/reports/audit/evv", "/reports/incidents", "/reports/supervision",
  "/documents", "/sops", "/settings",
  "/clients/care-plans",
  "/portal/login", "/portal/care", "/portal/care/documents", "/portal/work", "/portal/work/schedule",
];
const shots = [];
for (const r of routes) {
  await page.goto(`${base}#${r}`);
  await page.waitForTimeout(900);
  const name = (r === "/" ? "home" : r.slice(1).replace(/\//g, "-")) + ".png";
  await page.screenshot({ path: `${out}/${name}`, fullPage: true });
  const h1 = await page.locator("h1").first().innerText().catch(() => "");
  shots.push({ r, name, h1 });
}
// record pages: first client, first employee, first person
await page.goto(`${base}#/employees`); await page.waitForTimeout(800);
const empLinks = await page.evaluate(() => JSON.parse(localStorage.getItem("joy.demo.v1") ?? "{}") ? 1 : 0);
await page.goto(`${base}#/employees/emp-chanel`); await page.waitForTimeout(800);
for (const tab of ["Profile", "Activity", "Employment & Compliance", "Audit packet", "Schedule", "Docs", "Roles"]) {
  await page.getByRole("tab", { name: tab }).click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/employee-chanel-${tab.toLowerCase().replace(/[^a-z]+/g, "-")}.png`, fullPage: true });
}
await page.goto(`${base}#/clients`); await page.waitForTimeout(800);
await page.locator("table tbody tr").first().click().catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/clients-peek.png` });
// open the first client record via the peek's "Open" link if any
const openLink = page.locator("a[href*='#/clients/']").first();
if (await openLink.count()) { await openLink.click(); await page.waitForTimeout(800); }
for (const tab of ["Profile", "Activity", "Schedule", "Billing & Payments", "Care plan", "Documents"]) {
  const t = page.getByRole("tab", { name: tab });
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/client-${tab.toLowerCase().replace(/[^a-z]+/g, "-")}.png`, fullPage: true }); }
}
// scheduling views
await page.goto(`${base}#/scheduling`); await page.waitForTimeout(900);
for (const v of ["agenda", "calendar"]) {
  const t = page.getByRole("tab", { name: v }); if (await t.count()) { await t.first().click(); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/scheduling-${v}.png`, fullPage: true }); }
}
for (const b of ["Day", "Week", "Month"]) {
  const t = page.getByRole("button", { name: b, exact: true }); if (await t.count()) { await t.first().click(); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/scheduling-${b.toLowerCase()}.png`, fullPage: true }); }
}
// billing tabs
await page.goto(`${base}#/billing`); await page.waitForTimeout(900);
for (const tab of ["Invoices", "Payers", "Profitability", "LTCI"]) {
  const t = page.getByRole("tab", { name: new RegExp(tab, "i") }); if (await t.count()) { await t.first().click(); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/billing-${tab.toLowerCase()}.png`, fullPage: true }); }
}
// settings tabs
await page.goto(`${base}#/settings`); await page.waitForTimeout(800);
for (const tab of ["Appearance", "Agency", "Branding", "Roles", "Notifications", "Integrations", "Deleted items"]) {
  const t = page.getByRole("tab", { name: tab }); if (await t.count()) { await t.first().click(); await page.waitForTimeout(400); await page.screenshot({ path: `${out}/settings-${tab.toLowerCase().replace(/[^a-z]+/g, "-")}.png`, fullPage: true }); }
}
fs.writeFileSync(`${out}/index.json`, JSON.stringify(shots, null, 2));
console.log(JSON.stringify(shots));
await browser.close();
