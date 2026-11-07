import type Stripe from "stripe";
import { markPaid } from "@/lib/orders";
import { sendBill } from "@/lib/bill";
import { stripe } from "@/lib/stripe";

/** Webhook Stripe (test mode): stripe listen --forward-to localhost:3000/api/stripe/webhook */
function originOf(req: Request) {
  const h = req.headers;
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("stripe not configured", { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  // must be the raw body: the signature covers the exact bytes Stripe sent
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    // wrong secret (usually `stripe listen` printing a different whsec than the env) — log it loudly
    console.warn("stripe webhook: invalid signature:", e instanceof Error ? e.message.slice(0, 120) : e);
    return new Response("bad signature", { status: 400 });
  }

  console.log("stripe webhook:", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (orderId && session.payment_status === "paid") {
      const first = await markPaid(orderId, session.id);
      if (first) await sendBill(orderId, originOf(req));
    }
  }

  return new Response("ok", { status: 200 });
}
