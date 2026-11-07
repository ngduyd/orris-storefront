"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getOrder, RESERVATION_MINUTES } from "@/lib/orders";
import { currentUser } from "@/lib/auth";
import { usdMinor } from "@/lib/money";
import { stripe } from "@/lib/stripe";

/**
 * Create a Stripe Checkout session (test mode) for an existing order. Prices come from the DB.
 * The order stays `pending` until the webhook confirms payment.
 *
 * One session per order: a stored session id is reused while it is still open, so a double
 * click (or a retry after a slow redirect) can never create a second charge.
 */
export async function payAction(fd: FormData) {
  const orderId = String(fd.get("orderId") ?? "");
  if (!orderId) return;
  if (!stripe) redirect(`/checkout/${orderId}?error=stripe`);

  const viewer = await currentUser();
  const order = await getOrder(orderId);
  if (!order) redirect("/shop");
  // server actions can be called directly: check permissions here, do not trust the page
  if (!viewer || (order.userId !== viewer.id && order.email !== viewer.email)) redirect("/shop");
  if (order.paid) redirect(`/checkout/${orderId}`);
  // the hold is over: nothing to pay for, the stock already went back
  if (order.status !== "pending" || order.stockReleased) redirect(`/checkout/${orderId}`);

  const origin = (await headers()).get("origin") ?? `http://${(await headers()).get("host")}`;

  if (order.stripeId) {
    const existing = await stripe.checkout.sessions.retrieve(order.stripeId).catch(() => null);
    if (existing?.status === "open" && existing.url) redirect(existing.url);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    customer_email: order.email,
    line_items: order.items.map((i) => ({
      quantity: i.qty,
      price_data: {
        currency: "usd",
        unit_amount: usdMinor(i.priceMinor), // SAR minor -> cents, matching the displayed price
        product_data: { name: i.title },
      },
    })),
    // Stripe refuses anything under 30 minutes, so give the hold one extra minute
    expires_at: Math.ceil(Date.now() / 1000) + RESERVATION_MINUTES * 60 + 60,
    success_url: `${origin}/api/stripe/confirm?orderId=${order.id}`,
    cancel_url: `${origin}/checkout/${order.id}?cancel=1`,
  });

  await db
    .update(orders)
    .set({ stripeId: session.id, ...(typeof session.payment_intent === "string" ? { stripePaymentIntent: session.payment_intent } : {}) })
    .where(eq(orders.id, order.id));
  redirect(session.url ?? `/checkout/${order.id}`);
}
