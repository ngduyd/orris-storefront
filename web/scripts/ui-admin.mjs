import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const out = [];

await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
out.push("anon /admin -> " + new URL(p.url()).pathname);

await p.fill("#__none", "").catch(() => {});
await p.fill('input[name="email"]', env.ADMIN_EMAIL);
await p.fill('input[name="password"]', "wrong-password");
await p.click('button:has-text("Sign in")');
await p.waitForTimeout(1200);
out.push("bad password -> " + new URL(p.url()).pathname + new URL(p.url()).search);

await p.fill('input[name="email"]', env.ADMIN_EMAIL);
await p.fill('input[name="password"]', env.ADMIN_PASSWORD);
await p.click('button:has-text("Sign in")');
await p.waitForURL("**/admin", { timeout: 15000 });
out.push("login -> " + new URL(p.url()).pathname);
out.push("overview cards: " + (await p.locator("main a").count()));
await p.screenshot({ path: "/tmp/shots/admin-overview.png", fullPage: true });

await p.goto(`${BASE}/admin/products?q=explorer`, { waitUntil: "networkidle" });
out.push("products q=explorer rows: " + (await p.locator("tbody tr").count()));
await p.screenshot({ path: "/tmp/shots/admin-products.png", fullPage: true });

await p.click('tbody tr:first-child a');
await p.waitForURL("**/admin/products/**");
const before = await p.inputValue('input[name="price"]');
await p.fill('input[name="price"]', String(Number(before) + 1));
await p.click('button:has-text("Save changes")');
await p.waitForTimeout(1500);
const after = await p.inputValue('input[name="price"]');
out.push(`price ${before} -> ${after} saved=${new URL(p.url()).searchParams.get("saved")}`);
await p.screenshot({ path: "/tmp/shots/admin-product-edit.png", fullPage: true });

await p.fill('input[name="price"]', before);
await p.click('button:has-text("Save changes")');
await p.waitForTimeout(1500);
out.push("restored " + (await p.inputValue('input[name="price"]')));

await p.goto(`${BASE}/admin/orders`, { waitUntil: "networkidle" });
out.push("orders rows: " + (await p.locator("tbody tr").count()));
await p.screenshot({ path: "/tmp/shots/admin-orders.png", fullPage: true });

await p.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await p.click('button:has-text("Sign out")');
await p.waitForTimeout(1000);
out.push("signout -> " + new URL(p.url()).pathname);
await p.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
out.push("after signout /admin/products -> " + new URL(p.url()).pathname + new URL(p.url()).search);

console.log(out.join("\n"));
await b.close();
