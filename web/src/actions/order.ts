"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentCart } from "@/lib/cart-cookie";
import { attachCartUser } from "@/lib/cart";
import { currentUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/order-access";
import { sendOrderClosed } from "@/lib/bill";
import { cancelOrder, getOrder, placeOrder } from "@/lib/orders";
import { clientIp, noteFailure, tooMany } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(400),
  phone: z.string().trim().min(6).max(32).regex(/^[0-9+()\-\s]+$/, "digits only"),
});

export type CheckoutState = { error?: string };

export async function checkoutAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const user = await currentUser();
  if (!user) return { error: "Please sign in to place an order." };

  // signed-in checkout: the account is the identity, the IP only adds a per-network limit when known
  const ip = await clientIp();
  const rateKey = ip ? `checkout-ip:${ip}` : `checkout-user:${user.id}`;
  if (tooMany(rateKey, 20)) redirect("/checkout?error=slow");
  noteFailure(rateKey, HOUR);

  if (process.env.REQUIRE_VERIFIED_EMAIL === "true") {
    const [me] = await db
      .select({ verified: users.emailVerifiedAt, provider: users.provider })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (me && !me.verified && me.provider !== "google") return { error: "Confirm your email first — check your inbox" };
  }

  const parsed = schema.safeParse({
    name: fd.get("name"),
    address: fd.get("address"),
    phone: String(fd.get("phone") ?? "").trim().slice(0, 32),
  });
  if (!parsed.success) return { error: "Check your name, address and phone." };

  const { cartId } = await currentCart();
  if (!cartId) return { error: "Your bag is empty." };

  await attachCartUser(cartId, user.id);

  const res = await placeOrder({
    cartId,
    email: user.email,
    userId: user.id,
    couponCode: String(fd.get("coupon") ?? "").slice(0, 32),
    ...parsed.data,
  });
  if (!res.ok) {
    if (res.error === "EMPTY_CART") return { error: "Your bag is empty." };
    if (res.error === "COUPON") return { error: "That coupon code is not valid." };
    return { error: "An item just sold out. Adjust your bag." };
  }

  revalidatePath("/", "layout");
  redirect(`/checkout/${res.orderId}`);
}

/** Customer cancels their own pending order; the stock goes back immediately. */
export async function cancelMyOrderAction(fd: FormData) {
  const id = String(fd.get("orderId") ?? "");
  const back = id ? `/checkout/${encodeURIComponent(id)}` : "/shop";
  const user = await currentUser();
  const order = id ? await getOrder(id) : null;
  if (!user || !order || !canAccessOrder(user, order)) redirect("/shop");

  const cancelled = await cancelOrder(order.id, user.email);
  if (cancelled) {
    const h = await headers();
    await sendOrderClosed(order.id, h.get("origin") ?? `http://${h.get("host")}`, "cancelled");
  }
  revalidatePath("/", "layout");
  redirect(`${back}?cancelled=1`);
}
