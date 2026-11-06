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
 * Tạo Stripe Checkout (test mode) cho đơn đã có. Giá đọc từ DB, không nhận từ client.
 * Đơn vẫn `pending` cho tới khi webhook xác nhận.
 */
export async function payAction(fd: FormData) {
  const orderId = String(fd.get("orderId") ?? "");
  if (!orderId) return;
  if (!stripe) redirect(`/checkout/${orderId}?error=stripe`);

  const viewer = await currentUser();
  const order = await getOrder(orderId);
  if (!order) redirect("/shop");
  // server action gọi được trực tiếp: phải tự kiểm quyền, không tin trang đã chặn
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
        unit_amount: usdMinor(i.priceMinor), // SAR minor -> cent, giống giá hiển thị
        product_data: { name: i.title },
      },
    })),
    success_url: `${origin}/api/stripe/confirm?orderId=${order.id}`,
    cancel_url: `${origin}/checkout/${order.id}?cancel=1`,
  });

  await db.update(orders).set({ stripeId: session.id }).where(eq(orders.id, order.id));
  redirect(session.url ?? `/checkout/${order.id}`);
}
