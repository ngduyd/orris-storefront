import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const HOST = process.argv[2] ?? "http://localhost:3000";
const LOG = "/tmp/shopify-server.log";
const email = `auth-${Date.now()}@example.com`;
const pw = "matkhau123";
const out = [];
const log = (m) => { out.push(m); console.log(m); };

const tokenFromLog = (path) => {
  const text = readFileSync(LOG, "utf8");
  const all = [...text.matchAll(new RegExp(`${path}\\?token=([a-f0-9]{64})`, "g"))];
  return all.length ? all[all.length - 1][1] : null;
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
const p = await ctx.newPage();

// checkout bắt đăng nhập
await p.goto(`${HOST}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
log("anon /checkout -> " + new URL(p.url()).pathname + new URL(p.url()).search);

// đăng ký
await p.goto(`${HOST}/account/register?next=%2Fcheckout`, { waitUntil: "networkidle" });
log("nút Google có: " + (await p.locator('a[href^="/api/auth/google/start"]').count()));
await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', pw);
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForURL("**/checkout", { timeout: 20000 });
log("sau đăng ký -> " + new URL(p.url()).pathname);
log("email trên checkout: " + (await p.locator("form p.text-sm").first().textContent()));

// đơn phải gắn tài khoản
await p.fill("#name", "Khach Auth");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**");
const orderId = p.url().split("/").pop();
log("đơn: " + orderId.slice(0, 8));

// lịch sử + banner xác thực
await p.goto(`${HOST}/account`, { waitUntil: "networkidle" });
log("đơn trong lịch sử: " + (await p.locator("tbody tr").count()));
log("banner chưa xác thực: " + (await p.getByText("Email chưa xác thực").count()));

// verify email qua link trong log
const vToken = tokenFromLog("/account/verify");
log("token verify trong log: " + (vToken ? "có" : "KHÔNG"));
if (vToken) {
  await p.goto(`${HOST}/account/verify?token=${vToken}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /confirm this address/i }).click();
  await p.waitForURL("**/account?verify=ok", { timeout: 20000 });
  log("banner sau verify: " + (await p.getByText("Email chưa xác thực").count()));
}

// đăng xuất, quên mật khẩu, đặt lại, đăng nhập lại
await p.getByRole("button", { name: /sign out/i }).click();
await p.waitForTimeout(1000);
await p.goto(`${HOST}/account/forgot`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', email);
await p.getByRole("button", { name: /send reset link/i }).click();
await p.waitForURL("**/account/forgot?sent=1", { timeout: 20000 });
log("forgot: đã gửi");
const rToken = tokenFromLog("/account/reset");
log("token reset trong log: " + (rToken ? "có" : "KHÔNG"));
if (rToken) {
  await p.goto(`${HOST}/account/reset?token=${rToken}`, { waitUntil: "networkidle" });
  await p.fill('input[name="password"]', "matkhaumoi9");
  await p.getByRole("button", { name: /save password/i }).click();
  await p.waitForURL("**/account/login?reset=1", { timeout: 20000 });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', "matkhaumoi9");
  await p.getByRole("button", { name: /sign in/i }).click();
  await p.waitForURL("**/account", { timeout: 20000 });
  log("đăng nhập bằng mật khẩu mới: OK");
  await p.getByRole("button", { name: /sign out/i }).click();
  await p.waitForTimeout(800);
}

// rate limit
await p.goto(`${HOST}/account/login`, { waitUntil: "networkidle" });
for (let i = 0; i < 6; i++) {
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', "sai-mat-khau");
  await p.getByRole("button", { name: /sign in/i }).click();
  await p.waitForTimeout(700);
}
log("sau 6 lần sai: " + (await p.locator("body").textContent()).includes("Quá nhiều lần thử"));

await b.close();
