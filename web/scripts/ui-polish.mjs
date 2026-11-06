import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const out = [];

await p.goto(`${BASE}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
out.push("bag badge trước khi thêm: " + (await p.locator('a[href="/cart"] span').count()));
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart", { timeout: 15000 });
await p.waitForTimeout(800);
out.push("bag badge sau khi thêm: " + (await p.locator('a[href="/cart"] span').textContent().catch(() => "none")));
out.push("cookie cart_n: " + (await ctx.cookies()).find((c) => c.name === "cart_n")?.value);

await p.goto(`${BASE}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
const d = p.locator("details");
out.push("details count: " + (await d.count()) + " open=" + (await d.first().evaluate((el) => el.open)));
await d.first().locator("summary").click();
out.push("sau click open=" + (await d.first().evaluate((el) => el.open)) + " text len=" + (await d.first().locator("p").textContent()).length);
await p.screenshot({ path: "/tmp/shots/mobile-product-details.png", fullPage: true });

const h = await p.evaluate(() => document.documentElement.scrollHeight);
out.push("cao trang mobile product: " + h);

await p.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
out.push("badge trên /shop: " + (await p.locator('a[href="/cart"] span').textContent().catch(() => "none")));
await p.screenshot({ path: "/tmp/shots/mobile-shop-badge.png", fullPage: false });

console.log(out.join("\n"));
await b.close();
