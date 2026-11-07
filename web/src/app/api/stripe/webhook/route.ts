import type Stripe from "stripe";
import { confirmSessionPaid } from "@/lib/bill";
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
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
      const outcome = await confirmSessionPaid(orderId, session.id, paymentIntent, originOf(req));
      // 500 makes Stripe retry: an event is never acknowledged while the money is neither kept nor refunded
      if (outcome === "failed") return new Response("confirm failed", { status: 500 });
    }
  }

  return new Response("ok", { status: 200 });
}
