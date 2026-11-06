import { chromium } from "playwright";
const HOST = "http://100.86.205.2:3000";
const email = `pay-${Date.now()}@example.com`;
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const log = (m) => console.log(m);
p.on("pageerror", (e) => log("pageerror " + e.message.slice(0, 120)));

await p.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', "matkhau123");
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForTimeout(4000);
log("sau đăng ký: " + p.url() + " | " + (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160));

await p.goto(`${HOST}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
await p.fill("#name", "Pay Test");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**", { timeout: 20000 });
log("order: " + new URL(p.url()).pathname.split("/").pop().slice(0, 8));
const payBtn = p.getByRole("button", { name: /^Pay \$/ });
log("nút Pay: " + (await payBtn.count()));
if (await payBtn.count()) {
  await payBtn.click();
  await p.waitForTimeout(6000);
  log("sau khi bấm Pay -> " + new URL(p.url()).host + new URL(p.url()).pathname.slice(0, 30));
  await p.screenshot({ path: "/tmp/shots/stripe-checkout.png" });
}
await b.close();
