import { chromium } from "playwright";
import Stripe from "stripe";

const BASE = "http://localhost:3000";
const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_secret";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy");
const out = [];

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();

await p.goto(`${BASE}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
await p.fill("#email", "stripe-test@example.com");
await p.fill("#name", "Stripe Test");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**");
const orderId = p.url().split("/").pop();
out.push("order tạo: " + orderId.slice(0, 8));
out.push("nút Pay hiện: " + (await p.getByRole("button", { name: /^Pay \$/ }).count()));

const payload = JSON.stringify({
  id: "evt_verify",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_verify", payment_status: "paid", metadata: { orderId }, client_reference_id: orderId } },
});

const bad = await fetch(`${BASE}/api/stripe/webhook`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
  body: payload,
});
out.push("chữ ký sai -> " + bad.status);

const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
const ok = await fetch(`${BASE}/api/stripe/webhook`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": header },
  body: payload,
});
out.push("chữ ký đúng -> " + ok.status + " " + (await ok.text()));

await p.goto(`${BASE}/checkout/${orderId}`, { waitUntil: "networkidle" });
out.push("tiêu đề trang đơn: " + (await p.locator("h1").textContent()));
await p.goto(`${BASE}/admin/orders`, { waitUntil: "networkidle" });
await p.screenshot({ path: "/tmp/shots/orders-paid.png", fullPage: false });

console.log(out.join("\n"));
await b.close();
