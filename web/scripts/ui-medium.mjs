/**
 * Browser check for the MEDIUM slice: checkout guard + per-IP rate limit, /account password
 * change, and review moderation hiding a review from the product page.
 *
 * Needs a server started with REQUIRE_VERIFIED_EMAIL=true on the given host, the shopify test
 * fixtures seeded, and ADMIN_EMAIL/ADMIN_PASSWORD in .env.local. Cleans up every row it creates.
 *
 *   npx next start -p 3102   # REQUIRE_VERIFIED_EMAIL=true
 *   node scripts/ui-medium.mjs http://127.0.0.1:3102
 */
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const HOST = process.argv[2] ?? "http://127.0.0.1:3102";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();

const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
const customerEmail = `wtb-${stamp}@example.com`;
const OLD_PW = "oldpassword1";
const NEW_PW = "newpassword1";
const reviewBody = `wtb review ${stamp}`;

const created = { userId: null, orderId: null, reviewId: null };
const out = [];
const log = (m) => {
  out.push(m);
  console.log(m);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();

async function cleanup() {
  if (created.reviewId) await db.query("delete from audit_logs where target_id = $1", [created.reviewId]);
  if (created.userId) {
    await db.query("delete from reviews where user_id = $1", [created.userId]);
    await db.query("delete from sessions where user_id = $1", [created.userId]);
    await db.query("delete from order_items where order_id in (select id from orders where user_id = $1)", [created.userId]);
    await db.query("delete from orders where user_id = $1", [created.userId]);
    await db.query("delete from users where id = $1", [created.userId]);
  }
}

try {
  // ---------- setup: customer account through the UI, review through SQL ----------
  await page.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', customerEmail);
  await page.fill('input[name="password"]', OLD_PW);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/account");
  const { rows: [me] } = await db.query("select id from users where email = $1", [customerEmail]);
  created.userId = me.id;
  log(`registered ${customerEmail}`);

  const { rows: [product] } = await db.query(
    "select handle, title from products where status = 'active' order by handle limit 1",
  );
  created.orderId = randomUUID();
  await db.query(
    "insert into orders (id, user_id, email, status, total_minor, paid) values ($1, $2, $3, 'paid', 10000, true)",
    [created.orderId, created.userId, customerEmail],
  );
  await db.query(
    "insert into order_items (id, order_id, handle, title, qty, price_minor) values ($1, $2, $3, $4, 1, 10000)",
    [randomUUID(), created.orderId, product.handle, product.title],
  );
  created.reviewId = randomUUID();
  await db.query(
    "insert into reviews (id, handle, user_id, rating, author_name, order_id, body) values ($1, $2, $3, 5, 'WTB', $4, $5)",
    [created.reviewId, product.handle, created.userId, created.orderId, reviewBody],
  );
  log(`seeded 5★ review on ${product.handle}`);

  // ---------- (a) product page before moderation ----------
  await page.goto(`${HOST}/product/${product.handle}`, { waitUntil: "networkidle" });
  const text = () => page.locator("body").innerText();
  const before = await text();
  log(`before: review visible = ${before.includes(reviewBody)}, "1 review" shown = ${before.includes("· 1 review")}`);
  if (!before.includes(reviewBody) || !before.includes("· 1 review")) throw new Error("review not visible before hiding");

  // ---------- (a) manager hides it ----------
  const adminCtx = await browser.newContext(); // separate session: a customer hits a redirect loop on /admin
  const admin = await adminCtx.newPage();
  await admin.goto(`${HOST}/admin/login`, { waitUntil: "networkidle" });
  await admin.fill('input[name="email"]', env.ADMIN_EMAIL);
  await admin.fill('input[name="password"]', env.ADMIN_PASSWORD);
  await admin.getByRole("button", { name: /sign in/i }).click();
  await admin.waitForURL("**/admin");
  await admin.goto(`${HOST}/admin/reviews`, { waitUntil: "networkidle" });
  log(`/admin/reviews rows = ${await admin.locator("tbody tr").count()}`);
  const row = admin.locator("tbody tr", { hasText: reviewBody });
  await row.getByRole("button", { name: /^hide$/i }).click();
  await admin.waitForURL("**/admin/reviews?saved=1");
  const hiddenRow = admin.locator("tbody tr", { hasText: reviewBody });
  log(`after hide button reads "${await hiddenRow.getByRole("button").innerText()}"`);

  await page.goto(`${HOST}/product/${product.handle}`, { waitUntil: "networkidle" });
  const after = await text();
  log(`after: review visible = ${after.includes(reviewBody)}, "1 review" shown = ${after.includes("· 1 review")}, "No store reviews yet." shown = ${after.includes("No store reviews yet.")}`);
  if (after.includes(reviewBody) || after.includes("· 1 review")) throw new Error("hidden review still on the product page");

  // unhide again so the cleanup leaves no half-moderated row behind
  await admin.goto(`${HOST}/admin/reviews`, { waitUntil: "networkidle" });
  await admin.locator("tbody tr", { hasText: reviewBody }).getByRole("button", { name: /^unhide$/i }).click();
  await admin.waitForURL("**/admin/reviews?saved=1");
  const { rows: audits } = await db.query("select action from audit_logs where target_id = $1 order by created_at", [
    created.reviewId,
  ]);
  log(`audit for the review: ${audits.map((a) => a.action).join(", ")}`);
  await adminCtx.close();

  // ---------- (b) change password ----------
  const ctx2 = await browser.newContext(); // second session that must be signed out by the change
  const page2 = await ctx2.newPage();
  await page2.goto(`${HOST}/account/login`, { waitUntil: "networkidle" });
  await page2.fill('input[name="email"]', customerEmail);
  await page2.fill('input[name="password"]', OLD_PW);
  await page2.getByRole("button", { name: /sign in/i }).click();
  await page2.waitForURL("**/account");

  await page.goto(`${HOST}/account`, { waitUntil: "networkidle" });
  await page.fill('input[name="currentPassword"]', "wrongpassword");
  await page.fill('input[name="newPassword"]', NEW_PW);
  await page.getByRole("button", { name: /save password/i }).click();
  await page.waitForURL("**/account?pw=wrong");
  log(`wrong current password -> "${await page.locator('p[role="alert"]').innerText()}"`);

  await page.fill('input[name="currentPassword"]', OLD_PW);
  await page.fill('input[name="newPassword"]', NEW_PW);
  await page.getByRole("button", { name: /save password/i }).click();
  await page.waitForURL("**/account?pw=ok");
  log(`changed -> "${await page.getByText(/password changed/i).innerText()}"`);

  await page2.goto(`${HOST}/account`, { waitUntil: "networkidle" });
  log(`other session after change -> ${new URL(page2.url()).pathname}`);
  await ctx2.close();

  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForTimeout(800);
  await page.goto(`${HOST}/account/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', customerEmail);
  await page.fill('input[name="password"]', OLD_PW);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(800);
  log(`old password -> ${new URL(page.url()).pathname} (${(await page.locator("form").innerText()).includes("Wrong email or password") ? "rejected" : "no error shown"})`);

  await page.fill('input[name="email"]', customerEmail);
  await page.fill('input[name="password"]', NEW_PW);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/account");
  log(`new password -> ${new URL(page.url()).pathname}, h1 "${await page.locator("h1").innerText()}"`);
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForTimeout(800);

  // ---------- (c) verified-email gate + 20/hour checkout limit ----------
  const ctx3 = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
  const buyer = await ctx3.newPage();
  await buyer.goto(`${HOST}/account/login`, { waitUntil: "networkidle" });
  await buyer.fill('input[name="email"]', customerEmail);
  await buyer.fill('input[name="password"]', NEW_PW);
  await buyer.getByRole("button", { name: /sign in/i }).click();
  await buyer.waitForURL("**/account");
  await buyer.goto(`${HOST}/product/${product.handle}`, { waitUntil: "networkidle" });
  // submit the form directly: the sticky gallery image overlaps the button in the desktop grid
  await buyer
    .locator("form", { has: buyer.getByRole("button", { name: /add to bag/i }) })
    .evaluate((f) => f.requestSubmit());
  await buyer.waitForURL("**/cart");
  await buyer.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });

  // the gate error text stays on screen, so count action POSTs instead of polling the DOM
  let posts = 0;
  buyer.on("response", (r) => {
    if (r.request().method() === "POST") posts += 1;
  });
  const waitPosts = async (n) => {
    const started = Date.now();
    while (posts < n) {
      if (Date.now() - started > 15000) throw new Error(`server action POST ${n} never happened`);
      await buyer.waitForTimeout(50);
    }
  };

  let slowAfter = 0;
  for (let i = 1; i <= 25; i++) {
    const seen = posts;
    await buyer.fill("#name", "Rate Limit");
    await buyer.fill("#address", "12 Somewhere Street, District 1");
    await buyer.getByRole("button", { name: /place order/i }).click();
    await waitPosts(seen + 1);
    if (i === 1) log(`gate on unverified account -> "${(await buyer.locator('p[role="alert"]').innerText()).trim()}"`);
    if (buyer.url().includes("error=slow")) {
      slowAfter = i;
      break;
    }
  }
  log(`21st attempt -> ${new URL(buyer.url()).pathname}${new URL(buyer.url()).search}`);
  log(`rate-limit message -> "${(await buyer.locator('p[role="alert"]').innerText()).trim()}"`);
  if (!slowAfter) throw new Error("rate limit never kicked in");
  await ctx3.close();
} finally {
  await cleanup();
  await db.end();
  await browser.close();
  log(`cleaned up rows for ${customerEmail}`);
}
