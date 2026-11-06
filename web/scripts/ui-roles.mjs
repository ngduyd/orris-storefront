import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const HOST = process.argv[2] ?? "http://100.86.205.2:3000";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const log = (m) => console.log(m);
const b = await chromium.launch();

// --- manager ---
const m = await (await b.newContext()).newPage();
await m.goto(`${HOST}/admin/login`, { waitUntil: "networkidle" });
await m.fill('input[name="email"]', env.ADMIN_EMAIL);
await m.fill('input[name="password"]', env.ADMIN_PASSWORD);
await m.getByRole("button", { name: /sign in/i }).click();
await m.waitForURL("**/admin", { timeout: 20000 });
log("manager login -> " + new URL(m.url()).pathname);
log("nav: " + (await m.locator("header nav a").allTextContents()).join(","));

await m.goto(`${HOST}/admin/stats`, { waitUntil: "networkidle" });
log("stats h1: " + (await m.locator("h1").textContent()) + " | dòng 14 ngày: " + (await m.locator("tbody tr").count()));

await m.goto(`${HOST}/admin/users`, { waitUntil: "networkidle" });
log("users rows: " + (await m.locator("tbody tr").count()));

await m.goto(`${HOST}/admin/orders`, { waitUntil: "networkidle" });
await m.locator("tbody tr a").first().click();
await m.waitForURL("**/admin/orders/**");
log("order detail có form vận chuyển: " + (await m.locator('form input[name="trackingCode"]').count()) + " | form manager: " + (await m.getByText("Order status (manager)").count()));

// --- đổi role 1 khách thành carrier ---
await m.goto(`${HOST}/admin/users?role=customer`, { waitUntil: "networkidle" });
const emailCell = m.locator("tbody tr").first();
const targetEmail = (await emailCell.locator("td").first().textContent()).split("provider")[0].trim();
await emailCell.locator("select").selectOption("carrier");
await m.getByRole("button", { name: /^Save$/ }).first().click();
await m.waitForTimeout(2500);
log("đổi role cho: " + targetEmail + " -> " + new URL(m.url()).search);

await m.goto(`${HOST}/admin/audit`, { waitUntil: "networkidle" });
log("audit rows: " + (await m.locator("tbody tr").count()));
log("audit actions: " + (await m.locator("tbody tr td:nth-child(3)").allTextContents()).slice(0, 5).join(","));

// header storefront có link Admin
await m.goto(`${HOST}/shop`, { waitUntil: "networkidle" });
log("link Admin ở storefront: " + (await m.locator('header a[href="/admin"]').count()));

await b.close();
