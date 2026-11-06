"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { currentCart } from "@/lib/cart-cookie";
import { currentUser } from "@/lib/auth";
import { placeOrder } from "@/lib/orders";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(400),
});

export type CheckoutState = { error?: string };

export async function checkoutAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const user = await currentUser();
  if (!user) return { error: "Please sign in to place an order." };

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
