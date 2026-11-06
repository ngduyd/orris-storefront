import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import Stripe from "stripe";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const HOST = "http://100.86.205.2:3000";
const email = `bill-${Date.now()}@example.com`;
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();

await p.goto(`${HOST}/account/register`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', "matkhau123");
await p.getByRole("button", { name: /create account/i }).click();
await p.waitForURL(/\/account$/, { timeout: 25000 });

await p.goto(`${HOST}/product/mont-blanc-mont-blanc-explorer-100ml`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /add to bag/i }).click();
await p.waitForURL("**/cart");
await p.goto(`${HOST}/checkout`, { waitUntil: "networkidle" });
await p.fill("#name", "Bill User");
await p.fill("#address", "12 Somewhere Street, District 1");
await p.getByRole("button", { name: /place order/i }).click();
await p.waitForURL("**/checkout/**", { timeout: 25000 });
const orderId = p.url().split("/").pop();
console.log("order: " + orderId.slice(0, 8) + " · email: " + email);

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const payload = JSON.stringify({
  id: "evt_bill", object: "event", type: "checkout.session.completed",
  data: { object: { id: "cs_bill", payment_status: "paid", metadata: { orderId }, client_reference_id: orderId } },
});
const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
const res = await fetch(`${HOST}/api/stripe/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sig }, body: payload });
console.log("webhook -> " + res.status);
await new Promise((r) => setTimeout(r, 2000));

const qp = (raw) => raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
const inbox = qp(readFileSync("/tmp/smtp-inbox.txt", "utf8"));
const bill = inbox.split("\n===\n").find((m) => m.includes("Ho") && m.includes(orderId.slice(0, 8)));
console.log("hoá đơn trong hộp thư: " + Boolean(bill));
if (bill) console.log(bill.split("\n").filter((l) => l.trim()).slice(0, 12).join("\n"));
await b.close();
