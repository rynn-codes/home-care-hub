import { chromium } from "playwright";
const port = process.argv[3] ?? "8099";
const out = process.argv[2] ?? "/tmp/claude-0/-home-claude/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad/shots";
const base = `http://localhost:${port}/index.html`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await browser.newContext({ viewport: { width: 1380, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
const setRole = async (name, role) => {
  await page.evaluate(([n, r]) => {
    const s = JSON.parse(localStorage.getItem("joy.demo.v1") ?? "{}");
    s.currentUser = { name: n, role: r };
    localStorage.setItem("joy.demo.v1", JSON.stringify(s));
  }, [name, role]);
  await page.reload();
  await page.waitForTimeout(1000);
};
const sidebar = async () => (await page.locator("aside nav a, [data-sidebar] a, nav a").allTextContents()).map((t) => t.trim()).filter(Boolean).join(" | ");

await page.goto(`${base}#/settings`);
await page.waitForTimeout(900);
await page.getByRole("tab", { name: "Roles" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/roles-1-tab-${port}.png`, fullPage: true });

await page.goto(`${base}#/`);
await setRole("John Segura", "operations");
console.log("operations:", await sidebar());
await page.goto(`${base}#/billing`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/roles-2-ops-billing-refused-${port}.png` });

// Owner grants Billing to Operations.
await page.goto(`${base}#/settings`);
await setRole("Karynn Verrett", "ceo_admin");
await page.getByRole("tab", { name: "Roles" }).click();
await page.getByLabel("Billing", { exact: true }).check();
await page.waitForTimeout(300);
await page.goto(`${base}#/`);
await setRole("John Segura", "operations");
console.log("operations + billing:", await sidebar());
await page.goto(`${base}#/billing`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/roles-3-ops-billing-granted-${port}.png` });

await page.goto(`${base}#/`);
await setRole("Kelsey Westley", "rn_clinical");
console.log("rn:", await sidebar());
await page.goto(`${base}#/`);
await setRole("Finance", "finance");
console.log("finance:", await sidebar());
await page.goto(`${base}#/`);
await setRole("Karynn Verrett", "ceo_admin");
await browser.close();
