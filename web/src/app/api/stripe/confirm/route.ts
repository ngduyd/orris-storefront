import { getOrder, markPaid } from "@/lib/orders";
import { sendBill } from "@/lib/bill";
import { stripe } from "@/lib/stripe";

/**
 * Stripe's success_url points here: confirm payment by asking Stripe directly,
 * instead of waiting for the webhook (which stays authoritative when the tab is closed).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") ?? "";
  const back = (q: string) => Response.redirect(`${url.origin}/checkout/${orderId}${q}`, 302);

  if (!orderId || !stripe) return Response.redirect(`${url.origin}/shop`, 302);

  const order = await getOrder(orderId);
  if (!order) return Response.redirect(`${url.origin}/shop`, 302);
  if (order.paid) return back("");

  const sessionId = order.stripeId;
  if (!sessionId) return back("?paid=1");

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
      const first = await markPaid(orderId, session.id, paymentIntent); // false = the webhook already handled it
      if (first) await sendBill(orderId, url.origin);
      return back("");
    }
  } catch (e) {
    console.error("stripe confirm lỗi:", e instanceof Error ? e.message.slice(0, 120) : e);
  }

  return back("?paid=1");
}
