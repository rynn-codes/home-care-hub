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

// A browser that saved its state before the test document existed.
await page.goto(`${base}#/documents`);
await page.waitForTimeout(900);
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("joy.demo.v1") ?? "{}");
  if (s.documents) s.documents = s.documents.filter((d) => d.id !== "doc-test-signature");
  localStorage.setItem("joy.demo.v1", JSON.stringify(s));
});
await page.reload();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/testdoc-documents-${port}.png` });
const first = await page.locator("ul.m-0.list-none li button[aria-label^=\"More for\"]").first().getAttribute("aria-label");
console.log("first file:", first);
await browser.close();
