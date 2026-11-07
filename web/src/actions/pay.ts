"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getOrder } from "@/lib/orders";
import { currentUser } from "@/lib/auth";
import { usdMinor } from "@/lib/money";
import { stripe } from "@/lib/stripe";

/**
 * Create a Stripe Checkout session (test mode) for an existing order. Prices come from the DB.
 * The order stays `pending` until the webhook confirms payment.
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

  const origin = (await headers()).get("origin") ?? `http://${(await headers()).get("host")}`;

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
    success_url: `${origin}/api/stripe/confirm?orderId=${order.id}`,
    cancel_url: `${origin}/checkout/${order.id}?cancel=1`,
  });

  await db.update(orders).set({ stripeId: session.id }).where(eq(orders.id, order.id));
  redirect(session.url ?? `/checkout/${order.id}`);
}
