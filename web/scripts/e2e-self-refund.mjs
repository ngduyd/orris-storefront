/**
 * Live check of the customer undo paths against a deployed store.
 *   refund (default): register -> bag -> checkout -> pay 4242 -> "Cancel and refund"
 *   cancel:           register -> bag -> checkout -> "Cancel order" (nothing charged)
 * Run: node scripts/e2e-self-refund.mjs <baseUrl> [refund|cancel]
 * The host is never baked in: it belongs to whoever runs the check, not to the repo.
 */
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? process.env.E2E_BASE_URL ?? "").replace(/\/+$/, "");
const MODE = process.argv[3] ?? "refund";
if (!BASE) throw new Error("usage: node scripts/e2e-self-refund.mjs <baseUrl> [refund|cancel]");
const stamp = Date.now();
const email = `e2e-refund-${stamp}@example.com`;
const password = `E2e-${stamp}-pass`;

const step = (m) => console.log(`\n▸ ${m}`);
const ok = (m) => console.log(`  ✓ ${m}`);

/** Some builds name the control differently; take whichever exists. */
async function clickAny(page, selectors) {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.click();
      return sel;
    }
  }
  throw new Error(`none of these exist: ${selectors.join(" | ")}`);
}

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
page.setDefaultTimeout(45_000);

try {
  step("register a fresh customer");
  await page.goto(`${BASE}/account/register`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button:has-text("Create account")');
  await page.waitForURL((u) => !u.pathname.includes("/register"), { timeout: 30_000 });
  ok(`signed in as ${email}`);

  step("put something in the bag");
  await page.goto(`${BASE}/shop`);
  const href = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  await page.goto(`${BASE}${href}`);
  await clickAny(page, ['button:has-text("Add to bag")', 'button:has-text("Add to cart")', 'form button[type="submit"]']);
  await page.waitForTimeout(1500);
  ok(`added ${href}`);

  step("check out");
  await page.goto(`${BASE}/cart`);
  await page.click('a[href="/checkout"]');
  await page.waitForURL("**/checkout");
  await page.fill('input[name="name"]', "E2E Buyer");
  await page.fill('input[name="phone"]', "+84901234567");
  await page.fill('textarea[name="address"]', "12 Le Loi, District 1, Ho Chi Minh City");
  await page.click('button:has-text("Place order")');
  await page
    .waitForURL(/\/checkout\/[0-9a-f-]{36}/, { timeout: 45_000, waitUntil: "domcontentloaded" })
    .catch(async (e) => {
      console.log(`  ! still on ${page.url()}`);
      console.log(`  ! page says: ${(await page.locator("body").innerText()).slice(0, 400).replace(/\n+/g, " | ")}`);
      throw e;
    });
  const orderUrl = page.url();
  ok(`order ${orderUrl.split("/").pop()}`);

  if (MODE === "cancel") {
    step("the customer cancels before paying");
    await page.click('text=Cancel order');
    await page.waitForFunction(() => document.body.innerText.includes("Order cancelled"), null, { timeout: 60_000 });
    const gone = await page.locator('text=Cancel order').count();
    const marked = /This order was cancelled/.test(await page.locator("body").innerText());
    console.log(`\n  cancel button gone: ${gone === 0 ? "yes" : "NO"}`);
    console.log(`  order marked cancelled: ${marked ? "yes" : "NO"}`);
    console.log(`\nOrder: ${orderUrl}\n`);
    if (gone !== 0 || !marked) throw new Error("pending cancel did not settle");
    console.log("✓ pending cancel works end to end");
    process.exit(0);
  }

  step("pay with the test card");
  await page.click('button:has-text("Pay ")');
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000, waitUntil: "domcontentloaded" });
  const emailField = page.locator('input#email');
  if (await emailField.count()) await emailField.fill(email).catch(() => {});
  await page.fill('input#cardNumber', "4242424242424242");
  await page.fill('input#cardExpiry', "12/34");
  await page.fill('input#cardCvc', "123");
  const nameOnCard = page.locator('input#billingName');
  if (await nameOnCard.count()) await nameOnCard.fill("E2E Buyer").catch(() => {});
  await clickAny(page, ['button[type="submit"]:has-text("Pay")', 'button:has-text("Pay")']);
  await page.waitForURL((u) => u.hostname !== "checkout.stripe.com", { timeout: 90_000, waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/checkout\/[0-9a-f-]{36}/, { timeout: 90_000, waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("Payment received"), null, { timeout: 60_000 });
  ok("payment confirmed, order is paid");

  step("the customer asks for their money back");
  await page.click('text=Cancel and refund');
  await page.waitForFunction(() => document.body.innerText.includes("Refunded."), null, { timeout: 60_000 });
  ok("page says the card was refunded");

  const stillThere = await page.locator('text=Cancel and refund').count();
  const body = await page.locator("body").innerText();
  console.log(`\n  refund button gone: ${stillThere === 0 ? "yes" : "NO"}`);
  console.log(`  order marked refunded: ${/This order was refunded/.test(body) ? "yes" : "NO"}`);
  console.log(`\nOrder: ${orderUrl}\n`);
  if (stillThere !== 0 || !/This order was refunded/.test(body)) throw new Error("refund did not settle");
  console.log("✓ live refund path works end to end");
} finally {
  await browser.close();
}
