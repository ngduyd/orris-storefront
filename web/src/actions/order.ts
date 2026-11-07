"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentCart } from "@/lib/cart-cookie";
import { currentUser } from "@/lib/auth";
import { placeOrder } from "@/lib/orders";
import { noteFailure, tooMany } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(400),
});

export type CheckoutState = { error?: string };

/** The first x-forwarded-for hop is the client when a proxy sits in front. */
async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function checkoutAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const user = await currentUser();
  if (!user) return { error: "Please sign in to place an order." };

  const rateKey = `checkout:${await clientIp()}`;
  if (tooMany(rateKey, 20, HOUR)) redirect("/checkout?error=slow");
  noteFailure(rateKey, HOUR);

  if (process.env.REQUIRE_VERIFIED_EMAIL === "true") {
    const [me] = await db
      .select({ verified: users.emailVerifiedAt, provider: users.provider })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (me && !me.verified && me.provider !== "google") return { error: "Confirm your email first — check your inbox" };
  }

  const parsed = schema.safeParse({ name: fd.get("name"), address: fd.get("address") });
  if (!parsed.success) return { error: "Check your name and address." };

  const { cartId } = await currentCart();
  if (!cartId) return { error: "Your bag is empty." };

  const res = await placeOrder({ cartId, email: user.email, userId: user.id, ...parsed.data });
  if (!res.ok) {
    return { error: res.error === "EMPTY_CART" ? "Your bag is empty." : "An item just sold out. Adjust your bag." };
  }

  revalidatePath("/", "layout");
  redirect(`/checkout/${res.orderId}`);
}
