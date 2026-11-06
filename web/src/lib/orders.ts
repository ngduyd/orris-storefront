import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, orderItems, orders, products } from "@/db/schema";

export type PlaceOrderInput = { cartId: string; email: string; name: string; address: string; userId?: string | null };

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalMinor: number }
  | { ok: false; error: "EMPTY_CART" | "OUT_OF_STOCK" };

/**
 * Tạo đơn pending. Giá LUÔN đọc từ DB tại thời điểm đặt, không nhận từ client.
 * Trừ stock, xoá giỏ, tất cả trong 1 transaction.
 */
export async function placeOrder({ cartId, email, name, address, userId }: PlaceOrderInput): Promise<PlaceOrderResult> {
  return db.transaction(async (tx) => {
    const lines = await tx
      .select({
        handle: cartItems.handle,
        qty: cartItems.qty,
        title: products.title,
        priceMinor: products.priceMinor,
        stock: products.stock,
      })
      .from(cartItems)
      .innerJoin(products, eq(products.handle, cartItems.handle))
      .where(eq(cartItems.cartId, cartId))
      .for("update", { of: products });

    if (!lines.length) return { ok: false as const, error: "EMPTY_CART" as const };
    if (lines.some((l) => l.qty > l.stock)) return { ok: false as const, error: "OUT_OF_STOCK" as const };

    const totalMinor = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0);
    const orderId = randomUUID();

    await tx.insert(orders).values({
      id: orderId,
      userId: userId ?? null,
      email,
      customerName: name,
      address,
      status: "pending",
      totalMinor,
    });

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        id: randomUUID(),
        orderId,
        handle: l.handle,
        title: l.title,
        qty: l.qty,
        priceMinor: l.priceMinor,
      })),
    );

    for (const l of lines) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${l.qty}`, updatedAt: new Date() })
        .where(eq(products.handle, l.handle));
    }

    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
    return { ok: true as const, orderId, totalMinor };
  });
}

export async function getOrder(id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...order, items };
}

/** Webhook gọi: chỉ đơn còn pending mới đổi, tránh ghi đè cancelled/refunded. */
export async function markPaid(orderId: string, stripeId: string) {
  const updated = await db
    .update(orders)
    .set({ status: "paid", paid: true, stripeId })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return updated.length > 0;
}
