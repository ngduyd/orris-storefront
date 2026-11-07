import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, coupons, orderItems, orders, products } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { stripe } from "@/lib/stripe";

/** Flat shipping in SAR minor units; 0 means free. Free above a threshold when set. */
export function shippingFor(subtotalMinor: number) {
  const flat = Number(process.env.SHIPPING_FLAT_MINOR ?? 0);
  const freeOver = Number(process.env.FREE_SHIPPING_OVER_MINOR ?? 0);
  if (!flat || flat < 0) return 0;
  if (freeOver > 0 && subtotalMinor >= freeOver) return 0;
  return flat;
}

/** Percent discount from the coupons table. Unknown or inactive codes are rejected. */
export async function couponDiscount(code: string | null | undefined, subtotalMinor: number) {
  const key = (code ?? "").trim().toUpperCase().slice(0, 32);
  if (!key) return { ok: true as const, discountMinor: 0, code: null };
  const [row] = await db.select().from(coupons).where(eq(coupons.code, key)).limit(1);
  if (!row || !row.active) return { ok: false as const };
  const discountMinor = Math.floor((subtotalMinor * Math.min(row.percent, 90)) / 100);
  return { ok: true as const, discountMinor, code: key };
}

type PlaceOrderInput = {
  cartId: string;
  email: string;
  name: string;
  address: string;
  phone?: string;
  couponCode?: string | null;
  userId?: string | null;
};

export type PlaceOrderResult =
  | { ok: true; orderId: string; totalMinor: number }
  | { ok: false; error: "EMPTY_CART" | "OUT_OF_STOCK" | "COUPON" };

/**
 * How long a pending order holds its stock. Longer than Stripe's 30-minute minimum session lifetime,
 * so a legal session can always expire before the hold does. Expiry is still live when the hold is
 * older than (RESERVATION_MINUTES - 30) minutes: payAction then extends the hold, once, bounded.
 */
export const RESERVATION_MINUTES = 35;

/**
 * Create a pending order. Prices ALWAYS come from the DB at checkout time, never from the client.
 * Decrement stock and clear the cart in one transaction; the stock stays held until the reservation expires.
 */
export async function placeOrder({ cartId, email, name, address, phone, couponCode, userId }: PlaceOrderInput): Promise<PlaceOrderResult> {
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

    const subtotalMinor = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0);
    const coupon = await couponDiscount(couponCode, subtotalMinor);
    if (!coupon.ok) return { ok: false as const, error: "COUPON" as const };
    const shippingMinor = shippingFor(subtotalMinor);
    const totalMinor = Math.max(0, subtotalMinor + shippingMinor - coupon.discountMinor);
    const orderId = randomUUID();

    await tx.insert(orders).values({
      id: orderId,
      userId: userId ?? null,
      email,
      customerName: name,
      address,
      phone: phone?.trim().slice(0, 32) ?? "",
      status: "pending",
      subtotalMinor,
      shippingMinor,
      discountMinor: coupon.discountMinor,
      couponCode: coupon.code,
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

/**
 * Cancel every pending order whose hold ran out and give its stock back. Safe to call often.
 * A NULL reserved_until (rows written before the column existed) counts as expired once the order
 * is older than RESERVATION_MINUTES. Claim, item read and increments share one transaction, so the
 * sweep cannot interleave with itself and hand the same qty back twice. Returns the orders claimed.
 */
export async function releaseExpiredReservations() {
  return db.transaction(async (tx) => {
    const expired = await tx
      .update(orders)
      .set({ status: "cancelled", stockReleased: true })
      .where(
        and(
          eq(orders.status, "pending"),
          eq(orders.stockReleased, false),
          or(
            lt(orders.reservedUntil, sql`now()`),
            and(isNull(orders.reservedUntil), lt(orders.createdAt, sql`now() - (${RESERVATION_MINUTES} * interval '1 minute')`)),
          ),
        ),
      )
      .returning({ id: orders.id });
    if (!expired.length) return 0;

    const items = await tx
      .select({ handle: orderItems.handle, qty: orderItems.qty })
      .from(orderItems)
      .where(inArray(orderItems.orderId, expired.map((o) => o.id)));
    for (const i of items) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${i.qty}`, updatedAt: new Date() })
        .where(eq(products.handle, i.handle));
    }
    return expired.length;
  });
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
 * Refund a paid order. The claim (paid -> refunded) happens BEFORE the Stripe call so two buttons
 * cannot refund twice; the refund carries an idempotency key, and a Stripe error rolls the claim
 * back so the order never lies about the money. Without Stripe this is a manual refund.
 */
export async function refundOrder(orderId: string, actorEmail: string) {
  const [before] = await db
    .select({ status: orders.status, paid: orders.paid, stripePaymentIntent: orders.stripePaymentIntent })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!before?.paid) return false;

  const [claimed] = await db
    .update(orders)
    .set({ status: "refunded", paid: false })
    .where(and(eq(orders.id, orderId), eq(orders.paid, true)))
    .returning({ id: orders.id });
  if (!claimed) return false;

  if (stripe && before.stripePaymentIntent) {
    try {
      await stripe.refunds.create({ payment_intent: before.stripePaymentIntent }, { idempotencyKey: `refund:${orderId}` });
    } catch (e) {
      console.error("stripe refund failed:", e instanceof Error ? e.message.slice(0, 120) : e);
      await db.update(orders).set({ status: before.status, paid: true }).where(eq(orders.id, orderId));
      return false;
    }
  }

  await releaseStock(orderId);
  await writeAudit({
    actorId: null,
    actorEmail,
    action: "order.refund",
    targetType: "order",
    targetId: orderId,
    detail: before.stripePaymentIntent && stripe ? "stripe refund, stock restored" : "manual refund, stock restored",
  });
  return true;
}

/**
 * A payment that lands after the hold was released must never quietly keep the money.
 * Used by the webhook, the confirmation route and the pay button when markPaid refused.
 * Safe to retry: the refund key is derived from the session and the order flips to refunded once.
 */
export async function refundLatePayment(orderId: string, sessionId: string, paymentIntent: string | null) {
  if (!(await refundOrder(orderId, "stripe:late-payment"))) {
    if (!stripe || !paymentIntent) return false;
    try {
      await stripe.refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `late:${sessionId || paymentIntent}` });
    } catch (e) {
      console.error("stripe late refund failed:", e instanceof Error ? e.message.slice(0, 120) : e);
      return false;
    }
    // keep the intent so a later manual refund and the refund page still have something to work with
    await db.update(orders).set({ status: "refunded", stripePaymentIntent: paymentIntent }).where(eq(orders.id, orderId));
  }

  await writeAudit({
    actorId: null,
    actorEmail: "stripe:late-payment",
    action: "order.refund",
    targetType: "order",
    targetId: orderId,
    detail: "late payment auto-refund",
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
