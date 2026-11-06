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

  // phải là raw body: ký trên đúng bytes Stripe gửi
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    // sai secret (thường do whsec của `stripe listen` khác trong env) — log để thấy ngay
    console.warn("stripe webhook: chữ ký không hợp lệ:", e instanceof Error ? e.message.slice(0, 120) : e);
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
