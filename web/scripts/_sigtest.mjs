import { readFileSync } from "node:fs";
import Stripe from "stripe";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const HOST = "http://100.86.205.2:3000";
const orderId = process.argv[2];
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const payload = JSON.stringify({
  id: "evt_manual",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_manual", payment_status: "paid", metadata: { orderId }, client_reference_id: orderId } },
});

for (const [label, secret] of [["đúng secret trong .env.local", env.STRIPE_WEBHOOK_SECRET], ["sai secret", "whsec_wrong"]]) {
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(`${HOST}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
  console.log(`${label} -> ${res.status} ${(await res.text()).slice(0, 40)}`);
}
