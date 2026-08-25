#!/usr/bin/env node
/**
 * Design diff — what the mockups say that the app does not.
 *
 * Karynn, 25 August: "Why are there so many errors to change/fix? It's taking
 * forever to get this product shipped bc the claude design and code are not in
 * sync."
 *
 * The honest answer was that nothing checked. Screens were reconciled by
 * reading a mockup, building from it, and declaring it done — so anything
 * skipped stayed skipped until she happened to look at that part of that screen.
 * "View Joy Operations" sat missing for weeks that way.
 *
 * This finds them mechanically instead. It extracts every visible phrase from
 * each mockup and reports the ones that appear neither on the rendered screen
 * nor anywhere in src/ — the second check matters, because a phrase behind a
 * tab is built, just not on the default view, and counting those as gaps buries
 * the real ones in noise.
 *
 * It reports text only. Layout, spacing and colour still need eyes. What it
 * catches is the category that actually bit us: a whole control, section or
 * sentence that never got built.
 *
 *   node scripts/design-diff.mjs                 # against a running preview
 *   node scripts/design-diff.mjs --json          # machine-readable
 *
 * Expects a build being served at BASE (default http://127.0.0.1:4174).
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://127.0.0.1:4174";
const ROOT = path.resolve(import.meta.dirname, "..");
const MOCKS = path.join(ROOT, "docs/mockups");
const JSON_OUT = process.argv.includes("--json");

/** Which mockup answers for which built routes. */
const PAIRS = [
  ["Joy Health The Brain", ["/brain", "/brain/my-work", "/brain/operations"]],
  ["Joy Health Clients", ["/clients", "/clients/care-plans"]],
  ["Joy Health Employees", ["/employees"]],
  ["Joy Health Scheduling", ["/scheduling"]],
  ["Joy Health Billing", ["/billing"]],
  ["Joy Health Payroll", ["/payroll"]],
  ["Joy Health Hiring", ["/operations/hiring"]],
  ["Joy Health Admissions", ["/admissions"]],
];

// The mockups' own chrome — their signed-in user, their nav, their frozen
// clock. None of it is a gap in the app; all of it would drown the report.
const NOISE =
  /joan robinson|karynn reed|administrator|chief executive|^dashboard$|^hiring$|aug(ust)? \d|^(mon|tue|wed|thu|fri|sat|sun)[,a-z]*\b|\d{1,2}:\d\d|^(details|cancel|close|filter|empty|status|actions|review|summary|activity|today|completed|scheduled|new|view all)$/;

const squash = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Visible text of a .dc.html mockup, in document order, de-duplicated. */
function mockPhrases(file) {
  let s = fs.readFileSync(file, "utf8");
  s = s.replace(/<(script|style|svg|helmet)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<[^>]+>/g, "\n");
  s = s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/gi, " ");
  const seen = new Set();
  const out = [];
  for (const raw of s.split("\n")) {
    const t = squash(raw).replace(/\{\{.*?\}\}/g, "").trim();
    if (t.length < 6 || t.length > 90) continue;
    if (/^[\d\s.,:%$/·—–-]+$/.test(t)) continue;
    if (NOISE.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Every string literal the app ships, so tab-hidden copy is not a gap. */
function sourceBlob() {
  const parts = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) parts.push(fs.readFileSync(p, "utf8"));
    }
  };
  walk(path.join(ROOT, "src"));
  return squash(parts.join(" "));
}

// Launch the browser this machine actually has. Playwright reaches for a
// headless shell whose version is pinned to whichever @playwright/test resolves
// first, and in this environment that is not the build on disk. PW_CHROMIUM (or
// the conventional /opt/pw-browsers/chromium symlink) points at the real one;
// falling through to the default keeps this working on a normal laptop.
const explicit = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch(
  fs.existsSync(explicit) ? { executablePath: fs.realpathSync(explicit) } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(BASE);
await page.evaluate(() => {
  localStorage.setItem(
    "sb-xembwxgilrsjeybuwxwt-auth-token",
    JSON.stringify({
      access_token: "demo",
      refresh_token: "demo",
      expires_at: 9999999999,
      user: { id: "demo-staff", email: "demo@joyhealth.example", user_metadata: { role: "staff" } },
    }),
  );
});

const BLOB = sourceBlob();
const report = [];

for (const [mockName, routes] of PAIRS) {
  const file = path.join(MOCKS, `${mockName}.dc.html`);
  if (!fs.existsSync(file)) {
    report.push({ screen: mockName, error: "mockup not vendored", gaps: [] });
    continue;
  }
  let rendered = "";
  for (const route of routes) {
    await page.goto(BASE + route);
    await page.waitForTimeout(600);
    rendered += " || " + squash(await page.locator("body").innerText());
  }
  const gaps = mockPhrases(file).filter((p) => !rendered.includes(p) && !BLOB.includes(p));
  report.push({ screen: mockName.replace("Joy Health ", ""), routes, gaps });
}

await browser.close();

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  let total = 0;
  for (const r of report) {
    if (r.error) {
      console.log(`\n### ${r.screen} — ${r.error}`);
      continue;
    }
    total += r.gaps.length;
    console.log(`\n### ${r.screen} — ${r.gaps.length} absent  (${r.routes.join(", ")})`);
    for (const g of r.gaps) console.log("   •", g);
  }
  console.log(`\nTOTAL: ${total} phrases present in the mockups and absent from the app.`);
}
