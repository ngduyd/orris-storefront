import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const HOST = "http://100.86.205.2:3000";
const HANDLE = "mont-blanc-mont-blanc-explorer-100ml";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const log = (m) => console.log(m);
const b = await chromium.launch();

// ---------- buyer: real test-mode payment ----------
const buyerCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await buyerCtx.newPage();
const email = `refund-${Date.now()}@example.com`;

await p.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', "matkhau123");
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForURL(/\/account$/, { timeout: 25000 });

await p.goto(`${HOST}/product/${HANDLE}`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
await p.fill("#name", "Refund Buyer");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**", { timeout: 25000 });
const orderId = p.url().split("/").pop();
log("order: " + orderId.slice(0, 8));

await p.getByRole("button", { name: /^Pay \$/ }).click();
await p.waitForURL(/checkout\.stripe\.com/, { timeout: 40000 });
log("stripe checkout mở: " + new URL(p.url()).host);

// Stripe hosted checkout (test mode)
await p.locator("#cardNumber").fill("4242424242424242");
await p.locator("#cardExpiry").fill("1234");
await p.locator("#cardCvc").fill("123");
const nameField = p.locator("#billingName");
if (await nameField.count()) await nameField.fill("Refund Buyer");
const zip = p.locator("#billingPostalCode");
if (await zip.count()) await zip.fill("12345");
await p.getByRole("button", { name: /^Pay/ }).first().click();
await p.waitForURL(/\/checkout\/[0-9a-f-]{36}/, { timeout: 90000 });
await p.waitForTimeout(2500);
log("quay về: " + new URL(p.url()).pathname + new URL(p.url()).search);
log("tiêu đề trang đơn: " + (await p.locator("h1").first().textContent()));

// ---------- invoice / print page ----------
const inv = await p.goto(`${HOST}/checkout/${orderId}/invoice`, { waitUntil: "networkidle" });
log("invoice status: " + inv.status() + " | có chữ INVOICE: " + (await p.getByText(/invoice/i).count()));
log("invoice dòng hàng: " + (await p.locator("tbody tr").count()) + " | tổng: " + (await p.getByText(/Total/i).count()));
await p.emulateMedia({ media: "print" });
const headerVisible = await p.locator("header").first().isVisible().catch(() => false);
log("khi in, header site ẩn: " + !headerVisible);
await p.screenshot({ path: "/tmp/shots/invoice-print.png", fullPage: true });
await p.emulateMedia({ media: "screen" });

// stock before refund
const stockBefore = await fetch(`${HOST}/shop?q=explorer`).then(() => null).catch(() => null);
console.log("ORDER=" + orderId);
console.log("EMAIL=" + email);
await buyerCtx.close();

// ---------- manager: refund ----------
const adminCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const a = await adminCtx.newPage();
await a.goto(`${HOST}/admin/login`, { waitUntil: "networkidle" });
await a.fill('input[name="email"]', env.ADMIN_EMAIL);
await a.fill('input[name="password"]', env.ADMIN_PASSWORD);
await a.getByRole("button", { name: /sign in/i }).click();
await a.waitForURL(/\/admin$/, { timeout: 25000 });
await a.goto(`${HOST}/admin/orders/${orderId}`, { waitUntil: "networkidle" });
log("admin thấy đơn: status=" + (await a.locator("dd").nth(3).textContent()) + " paid=" + (await a.locator("dd").nth(4).textContent()));

const refund = a.getByRole("button", { name: /^refund/i });
log("nút Refund: " + (await refund.count()));
await a.screenshot({ path: "/tmp/shots/admin-refund-before.png", fullPage: false });
await refund.click();
await a.waitForTimeout(6000);
await a.goto(`${HOST}/admin/orders/${orderId}`, { waitUntil: "networkidle" });
log("sau refund: status=" + (await a.locator("dd").nth(3).textContent()) + " paid=" + (await a.locator("dd").nth(4).textContent()));
log("nút Refund còn: " + (await a.getByRole("button", { name: /^refund/i }).count()));
await a.screenshot({ path: "/tmp/shots/admin-refund-after.png", fullPage: false });
await b.close();
