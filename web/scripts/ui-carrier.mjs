import { chromium } from "playwright";
const HOST = "http://100.86.205.2:3000";
const EMAIL = process.argv[2];
const log = (m) => console.log(m);
const b = await chromium.launch();

const c = await (await b.newContext()).newPage();
await c.goto(`${HOST}/admin/login`, { waitUntil: "networkidle" });
await c.fill('input[name="email"]', EMAIL);
await c.fill('input[name="password"]', "matkhau123");
await c.getByRole("button", { name: /sign in/i }).click();
await c.waitForURL("**/admin/orders", { timeout: 20000 });
log("carrier login -> " + new URL(c.url()).pathname);
log("nav: " + (await c.locator("header nav a").allTextContents()).join(","));

await c.goto(`${HOST}/admin/products`, { waitUntil: "networkidle" });
log("carrier vào /admin/products -> " + new URL(c.url()).pathname + new URL(c.url()).search);
await c.goto(`${HOST}/admin/users`, { waitUntil: "networkidle" });
log("carrier vào /admin/users -> " + new URL(c.url()).pathname + new URL(c.url()).search);

await c.goto(`${HOST}/admin/orders`, { waitUntil: "networkidle" });
await c.locator("tbody tr a").first().click();
await c.waitForURL("**/admin/orders/**");
log("form manager thấy: " + (await c.getByText("Order status (manager)").count()));
await c.fill('input[name="carrier"]', "SMSA");
await c.fill('input[name="trackingCode"]', "SMSA-123456");
await c.selectOption('select[name="status"]', "shipped");
await c.getByRole("button", { name: /update shipment/i }).click();
await c.waitForTimeout(2500);
log("sau cập nhật: " + new URL(c.url()).search + " | carrier=" + (await c.locator("dd").nth(5).textContent()) + " | tracking=" + (await c.locator("dd").nth(6).textContent()));
await c.screenshot({ path: "/tmp/shots/carrier-order.png", fullPage: true });
await b.close();
