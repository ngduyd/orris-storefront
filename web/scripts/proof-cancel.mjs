/**
 * Proof that the customer "Cancel order" button on /checkout/[id] gives the stock back.
 * Needs the built app running on :3101 and the wt-a database in .env.local.
 * Run: node --env-file=.env.local scripts/proof-cancel.mjs
 */
import { chromium } from "playwright";
import pg from "pg";

const HOST = process.env.PROOF_HOST ?? "http://127.0.0.1:3101";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const handle = `proof-cancel-${Date.now().toString(36)}`;
const email = `${handle}@example.com`;
const stockOf = async () => (await db.query("select stock from products where handle = $1", [handle])).rows[0]?.stock;

let orderId = null;
let browser;
let context;
let failed = null;

try {
  await db.query(
    `insert into products (handle, title, brand, gender, size_ml, price_minor, notes, image, status, stock)
     values ($1, 'Cancel Proof', 'Fixture', 'Unisex', 50, 25000, '{"top":["a"],"mid":["b"],"base":["c"]}', 'fixture.webp', 'active', 10)`,
    [handle],
  );

  browser = await chromium.launch();
  context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "matkhau123");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/account$/, { timeout: 25000 });
  console.log("registered:", email);

  await page.goto(`${HOST}/product/${handle}`, { waitUntil: "networkidle" });
  // the sticky gallery overlays the button at this viewport, so click it through the DOM
  await page.getByRole("button", { name: /add to bag/i }).evaluate((b) => b.click());
  await page.waitForURL("**/cart");

  await page.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
  await page.fill("#name", "Cancel Proof");
  await page.fill("#address", "1 Proof Street, Riyadh");
  await page.getByRole("button", { name: /place order/i }).click();
  await page.waitForURL(/\/checkout\/[0-9a-f-]{36}/, { timeout: 25000 });

  orderId = page.url().split("/").pop();
  console.log("order:", orderId, "| stock after checkout:", await stockOf());

  await page.getByRole("button", { name: /^cancel order$/i }).click();
  await page.waitForURL(/cancelled=1/, { timeout: 25000 });
  const notice = await page.getByText(/order cancelled\. the items are back in stock/i).count();

  const row = (await db.query("select status, stock_released from orders where id = $1", [orderId])).rows[0];
  console.log("after cancel | stock:", await stockOf(), "| status:", row.status, "| stock_released:", row.stock_released, "| notice:", notice);

  if ((await stockOf()) !== 10) throw new Error(`stock not restored: ${await stockOf()}`);
  if (row.status !== "cancelled" || row.stock_released !== true) throw new Error(`order not cancelled/released: ${row.status}/${row.stock_released}`);
  if (!notice) throw new Error("confirmation message missing on the order page");
  console.log("PROOF OK: stock 10 -> 9 on checkout, back to 10 after the customer cancel");
} catch (e) {
  failed = e;
} finally {
  const cartId = context ? (await context.cookies()).find((c) => c.name === "cart_id")?.value : null;
  if (browser) await browser.close();
  if (orderId) await db.query("delete from order_items where order_id = $1", [orderId]);
  if (orderId) await db.query("delete from orders where id = $1", [orderId]);
  if (cartId) await db.query("delete from cart_items where cart_id = $1", [cartId]);
  if (cartId) await db.query("delete from carts where id = $1", [cartId]);
  await db.query("delete from sessions where user_id in (select id from users where email = $1)", [email]);
  await db.query("delete from audit_logs where actor_email = $1", [email]);
  await db.query("delete from users where email = $1", [email]);
  await db.query("delete from products where handle = $1", [handle]);
  await db.end();
  console.log("cleaned up fixtures for", handle);
}

if (failed) {
  console.error("PROOF FAILED:", failed.message);
  process.exit(1);
}
