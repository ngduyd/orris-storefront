import { chromium } from "playwright";
const HOST = process.argv[2] ?? "http://localhost:3000";
const email = `khach-${Date.now()}@example.com`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
const p = await ctx.newPage();
const out = [];
const log = (m) => { out.push(m); console.log(m); };

// 1) đặt hàng với tư cách guest
await p.goto(`${HOST}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${HOST}/shop`, { waitUntil: "networkidle" });
log("header có Account: " + (await p.locator('header a[href="/account"]').count()));
await p.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
await p.fill("#email", email);
await p.fill("#name", "Khach Le");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**");
const orderId = p.url().split("/").pop();
log("guest order: " + orderId.slice(0, 8));

// 2) đăng ký cùng email -> phải thấy đơn guest trong lịch sử
await p.goto(`${HOST}/account`, { waitUntil: "networkidle" });
log("chưa login /account -> " + new URL(p.url()).pathname);
await p.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', "matkhau123");
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForURL("**/account");
log("sau đăng ký -> " + new URL(p.url()).pathname);
log("số đơn trong lịch sử: " + (await p.locator("tbody tr").count()));
log("h1: " + (await p.locator("h1").textContent()));

// 3) đơn mới tự gắn userId
await p.goto(`${HOST}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
log("email prefill: " + (await p.inputValue("#email")));
await p.fill("#name", "Khach Le");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**");
await p.goto(`${HOST}/account`, { waitUntil: "networkidle" });
log("số đơn sau đơn thứ 2: " + (await p.locator("tbody tr").count()));
await p.screenshot({ path: "/tmp/shots/account.png", fullPage: true });

// 4) đăng xuất
await p.getByRole("button", { name: /sign out/i }).click();
await p.waitForTimeout(1200);
await p.goto(`${HOST}/account`, { waitUntil: "networkidle" });
log("sau signout /account -> " + new URL(p.url()).pathname);

await b.close();
