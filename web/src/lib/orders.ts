import { randomUUID } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, orderItems, orders, products } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { stripe } from "@/lib/stripe";

export type PlaceOrderInput = { cartId: string; email: string; name: string; address: string; userId?: string | null };

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalMinor: number }
  | { ok: false; error: "EMPTY_CART" | "OUT_OF_STOCK" };

/** How long a pending order holds its stock. Stripe sessions use the same window. */
export const RESERVATION_MINUTES = 30;

/**
 * Create a pending order. Prices ALWAYS come from the DB at checkout time, never from the client.
 * Decrement stock and clear the cart in one transaction; the stock stays held until the reservation expires.
 */
export async function placeOrder({ cartId, email, name, address, userId }: PlaceOrderInput): Promise<PlaceOrderResult> {
  await releaseExpiredReservations();

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
      reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
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

/**
 * Put an order's stock back exactly once. The guarded UPDATE is the claim, so concurrent
 * callers (webhook, cron-ish page load, admin button) cannot restore the same qty twice.
 */
async function releaseStock(orderId: string) {
  const [claimed] = await db
    .update(orders)
    .set({ stockReleased: true })
    .where(and(eq(orders.id, orderId), eq(orders.stockReleased, false)))
    .returning({ id: orders.id });
  if (!claimed) return false;

  const items = await db.select({ handle: orderItems.handle, qty: orderItems.qty }).from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const i of items) {
    await db
      .update(products)
      .set({ stock: sql`${products.stock} + ${i.qty}`, updatedAt: new Date() })
      .where(eq(products.handle, i.handle));
  }
  return true;
}

/** Cancel all pending orders whose 30-minute hold ran out and give their stock back. Safe to call often. */
export async function releaseExpiredReservations() {
  const expired = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending"), eq(orders.stockReleased, false), lt(orders.reservedUntil, sql`now()`)));

  for (const { id } of expired) {
    const [claimed] = await db
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, id), eq(orders.status, "pending")))
      .returning({ id: orders.id });
    if (claimed) await releaseStock(id);
  }
  return expired.length;
}

/** Pending orders only; an already-cancelled order returns false so the caller can say so. */
export async function cancelOrder(orderId: string, actorEmail: string) {
  const [claimed] = await db
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  if (!claimed) return false;

  await releaseStock(orderId);
  await writeAudit({
    actorId: null,
    actorEmail,
    action: "order.cancel",
    targetType: "order",
    targetId: orderId,
    detail: "status -> cancelled, stock restored",
  });
  return true;
}

/**
 * Refund a paid order. The Stripe refund only fires when the payment intent was stored;
 * without Stripe configured this is a manual refund (money returned outside the app) and the
 * order is still marked refunded. A Stripe error aborts, so the order never lies about the money.
 */
export async function refundOrder(orderId: string, actorEmail: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.paid) return false;

  if (stripe && order.stripePaymentIntent) {
    try {
      await stripe.refunds.create({ payment_intent: order.stripePaymentIntent });
    } catch (e) {
      console.error("stripe refund failed:", e instanceof Error ? e.message.slice(0, 120) : e);
      return false;
    }
  }

  const [claimed] = await db
    .update(orders)
    .set({ status: "refunded", paid: false })
    .where(and(eq(orders.id, orderId), eq(orders.paid, true)))
    .returning({ id: orders.id });
  if (!claimed) return false;

  await releaseStock(orderId);
  await writeAudit({
    actorId: null,
    actorEmail,
    action: "order.refund",
    targetType: "order",
    targetId: orderId,
    detail: order.stripePaymentIntent && stripe ? "stripe refund, stock restored" : "manual refund, stock restored",
  });
  return true;
}

/**
 * Called by the webhook: only pending orders flip, so cancelled/refunded are never overwritten.
 * An order whose reservation was already returned must be refunded, never marked paid.
 */
export async function markPaid(orderId: string, stripeId: string, paymentIntent?: string | null) {
  const updated = await db
    .update(orders)
    .set({
      status: "paid",
      paid: true,
      stripeId,
      ...(paymentIntent ? { stripePaymentIntent: paymentIntent } : {}),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending"), eq(orders.stockReleased, false)))
    .returning({ id: orders.id });
  return updated.length > 0;
}
