import { chromium } from "playwright";
const HOST = "http://100.86.205.2:3000";
const email = `fav-${Date.now()}@example.com`;
const log = (m) => console.log(m);
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();

await p.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', "matkhau123");
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForURL(/\/account$/, { timeout: 25000 });

const product = "/product/mont-blanc-mont-blanc-explorer-100ml";
await p.goto(HOST + product, { waitUntil: "networkidle" });
log("nút wishlist: " + (await p.getByRole("button", { name: /save to wishlist/i }).textContent()));
await p.getByRole("button", { name: /save to wishlist/i }).click();
await p.waitForTimeout(2000);
log("sau khi lưu: " + (await p.getByRole("button", { name: /saved to wishlist/i }).count()));

await p.goto(`${HOST}/account/wishlist`, { waitUntil: "networkidle" });
log("wishlist rows: " + (await p.locator("li").count()) + " | " + (await p.locator("main h1").textContent()));

await p.goto(HOST + product, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
await p.fill("#name", "Fav User");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**", { timeout: 25000 });
const orderUrl = p.url();
log("đơn: " + orderUrl.split("/").pop().slice(0, 8));
log("timeline steps: " + (await p.locator("ol li").allTextContents()).join(" | "));
await p.screenshot({ path: "/tmp/shots/order-timeline.png", fullPage: true });
await b.close();
