/**
 * Accessibility gate: axe-core against the pages a customer or a manager actually uses.
 *
 * Fails on any serious or critical violation, so it can be run after UI changes like a lint step.
 * Needs a running server (any origin) and a manager account for the admin pages.
 *
 *   node scripts/a11y.mjs http://127.0.0.1:3000
 *   A11Y_MANAGER_EMAIL=... A11Y_MANAGER_PASSWORD=... node scripts/a11y.mjs https://example.com
 */
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!BASE) throw new Error("usage: node scripts/a11y.mjs <baseUrl>");

const MANAGER = process.env.A11Y_MANAGER_EMAIL && process.env.A11Y_MANAGER_PASSWORD
  ? { email: process.env.A11Y_MANAGER_EMAIL, password: process.env.A11Y_MANAGER_PASSWORD }
  : null;

const BLOCKING = new Set(["serious", "critical"]);
const WIDTHS = [
  { label: "desktop", width: 1280, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();
const failures = [];
let scanned = 0;

async function scan(page, path, label) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(400); // let fonts and transitions settle
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  scanned++;
  const bad = violations.filter((v) => BLOCKING.has(v.impact));
  for (const v of bad) {
    failures.push({ path, label, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") });
  }
  const note = bad.length ? `${bad.length} blocking` : violations.length ? `${violations.length} minor` : "clean";
  console.log(`  ${bad.length ? "✗" : "✓"} ${label.padEnd(7)} ${path.padEnd(34)} ${note}`);
}

try {
  for (const size of WIDTHS) {
    console.log(`\n▸ ${size.label} (${size.width}px)`);
    const page = await (await browser.newContext({ viewport: { width: size.width, height: size.height } })).newPage();
    for (const path of ["/", "/shop", "/cart", "/account/login", "/account/register"]) {
      await scan(page, path, size.label);
    }
    const handle = await page
      .goto(`${BASE}/shop`, { waitUntil: "load" })
      .then(() => page.locator('a[href^="/product/"]').first().getAttribute("href"));
    if (handle) await scan(page, handle, size.label);
  }

  if (MANAGER) {
    console.log("\n▸ admin (signed in)");
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/login`, { waitUntil: "load" });
    await page.fill('input[name="email"]', MANAGER.email);
    await page.fill('input[name="password"]', MANAGER.password);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL((u) => /^\/admin\/?$/.test(u.pathname), { waitUntil: "load" });
    for (const path of ["/admin", "/admin/orders", "/admin/users"]) await scan(page, path, "admin");
  } else {
    console.log("\n(admin pages skipped: set A11Y_MANAGER_EMAIL / A11Y_MANAGER_PASSWORD)");
  }
} finally {
  await browser.close();
}

console.log(`\n${scanned} page views scanned.`);
if (failures.length) {
  console.log(`\n${failures.length} blocking violation group(s):\n`);
  for (const f of failures) {
    console.log(`  ${f.impact}  ${f.id}  ${f.path} (${f.label})  nodes=${f.nodes}`);
    console.log(`            ${f.help}`);
    if (f.sample) console.log(`            first: ${f.sample}`);
  }
  process.exit(1);
}
console.log("No serious or critical violations.");
