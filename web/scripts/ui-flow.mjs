import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const log = [];
p.on("pageerror", (e) => log.push("pageerror " + e.message.slice(0, 100)));

await p.goto(`${BASE}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForTimeout(1200);

await p.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
log.push("cart forms: " + (await p.locator("form").count()));
await p.screenshot({ path: "/tmp/shots/mobile-cart-filled.png", fullPage: true });

await p.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
log.push("checkout path: " + new URL(p.url()).pathname);
await p.screenshot({ path: "/tmp/shots/mobile-checkout.png", fullPage: true });

await p.fill("#email", "test@example.com");
await p.fill("#name", "Test User");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForTimeout(3000);
log.push("after order path: " + new URL(p.url()).pathname);
await p.screenshot({ path: "/tmp/shots/mobile-order.png", fullPage: true });

console.log(log.join("\n"));
await b.close();
