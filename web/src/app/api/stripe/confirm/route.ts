import { getOrder } from "@/lib/orders";
import { confirmSessionPaid } from "@/lib/bill";
import { originFromHeaders } from "@/lib/origin";
import { stripe } from "@/lib/stripe";

/**
 * Stripe's success_url points here: confirm payment by asking Stripe directly,
 * instead of waiting for the webhook (which stays authoritative when the tab is closed).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  // not url.origin: behind nginx the app sees Host 0.0.0.0:3000 and Stripe's return would bounce there
  const origin = originFromHeaders(req.headers);
  const back = (q: string) => Response.redirect(`${origin}/checkout/${orderId}${q}`, 302);

  if (!orderId || !stripe) return Response.redirect(`${origin}/shop`, 302);

  const order = await getOrder(orderId);
  if (!order) return Response.redirect(`${origin}/shop`, 302);
  if (order.paid) return back("");

  const sessionId = order.stripeId;
  if (!sessionId) return back("?paid=1");

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
      const outcome = await confirmSessionPaid(orderId, session.id, paymentIntent, origin);
      if (outcome === "refunded") return back("?refunded=1"); // the hold was gone, money went back
      if (outcome === "failed") return back("?error=refund"); // nothing was kept: say so, never a silent ok
      return back("");
    }
  } catch (e) {
    console.error("stripe confirm lỗi:", e instanceof Error ? e.message.slice(0, 120) : e);
  }

  return back("?paid=1");
}
