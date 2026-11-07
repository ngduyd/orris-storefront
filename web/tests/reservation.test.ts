import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, orderItems, orders, products } from "@/db/schema";
import { cancelOrder, markPaid, releaseExpiredReservations } from "@/lib/orders";

// Fixture product, never the seeded catalogue: these tests move real stock.
const HANDLE = `test-reserve-${randomUUID().slice(0, 8)}`;
const STOCK = 100;
const orderIds: string[] = [];

async function seedProduct() {
  await db
    .insert(products)
    .values({
      handle: HANDLE,
      title: "Reservation Fixture",
      brand: "Fixture",
      gender: "Unisex",
      sizeMl: 50,
      priceMinor: 10000,
      notes: { top: ["a"], mid: ["b"], base: ["c"] },
      image: "fixture.webp",
      status: "active",
      stock: STOCK,
    })
    .onConflictDoNothing();
}

// idempotent seed in beforeEach so every test can also run alone (`-t "name"`)
beforeEach(seedProduct);

/** Insert an order and take its stock, the way placeOrder holds it at checkout. */
async function seedOrder(opts: { qty: number; reservedUntil: Date | null; stockReleased?: boolean; paid?: boolean; stripeId?: string }) {
  const orderId = randomUUID();
  await db.insert(orders).values({
    id: orderId,
    email: `res-${orderId.slice(0, 8)}@example.com`,
    status: opts.paid ? "paid" : "pending",
    paid: opts.paid ?? false,
    totalMinor: 10000 * opts.qty,
    reservedUntil: opts.reservedUntil,
    stockReleased: opts.stockReleased ?? false,
    stripeId: opts.stripeId,
  });
  await db.insert(orderItems).values({ id: randomUUID(), orderId, handle: HANDLE, title: "Reservation Fixture", qty: opts.qty, priceMinor: 10000 });
  await db.update(products).set({ stock: STOCK - opts.qty }).where(eq(products.handle, HANDLE));
  orderIds.push(orderId);
  return orderId;
}

const stock = async () => (await db.select({ s: products.stock }).from(products).where(eq(products.handle, HANDLE)))[0].s;
const readOrder = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

afterAll(async () => {
  if (orderIds.length) await db.delete(auditLogs).where(inArray(auditLogs.targetId, orderIds)); // cancelOrder audits
  if (orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
  if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));
  await db.delete(products).where(eq(products.handle, HANDLE));
});

describe("stock reservations", () => {
  it("expired reservation restores stock exactly once and cancels the order", async () => {
    const orderId = await seedOrder({ qty: 2, reservedUntil: new Date(Date.now() - 60_000) });
    expect(await stock()).toBe(STOCK - 2);

    await releaseExpiredReservations();
    expect(await stock()).toBe(STOCK);
    const after = await readOrder(orderId);
    expect(after.status).toBe("cancelled");
    expect(after.stockReleased).toBe(true);

    // running the sweep again must not hand the same qty back twice
    await releaseExpiredReservations();
    expect(await stock()).toBe(STOCK);
  });

  it("cancelOrder restores stock once and refuses an already-cancelled order", async () => {
    const orderId = await seedOrder({ qty: 3, reservedUntil: new Date(Date.now() + 60 * 60 * 1000) });
    expect(await stock()).toBe(STOCK - 3);

    expect(await cancelOrder(orderId, "staff@example.com")).toBe(true);
    expect(await stock()).toBe(STOCK);
    expect((await readOrder(orderId)).status).toBe("cancelled");

    expect(await cancelOrder(orderId, "staff@example.com")).toBe(false);
    expect(await stock()).toBe(STOCK);
  });

  it("markPaid refuses an order whose stock was already released", async () => {
    const orderId = await seedOrder({ qty: 1, reservedUntil: new Date(Date.now() - 60_000), stockReleased: true });
    expect(await markPaid(orderId, `cs_test_${orderId}`)).toBe(false);
    const after = await readOrder(orderId);
    expect(after.paid).toBe(false);
    expect(after.status).toBe("pending");
  });

  it("a pending order without reserved_until is swept once it is old enough", async () => {
    const old = await seedOrder({ qty: 1, reservedUntil: null });
    await db.update(orders).set({ createdAt: new Date(Date.now() - 40 * 60_000) }).where(eq(orders.id, old));
    const young = await seedOrder({ qty: 1, reservedUntil: null });

    await releaseExpiredReservations();
    expect((await readOrder(old)).status).toBe("cancelled");
    expect((await readOrder(old)).stockReleased).toBe(true);
    expect((await readOrder(young)).status).toBe("pending");
  });
});

describe("one checkout session per order", () => {
  it("a second order with the same stripe_id is rejected by the unique index", async () => {
    const stripeId = `cs_test_dup_${randomUUID().slice(0, 8)}`;
    await seedOrder({ qty: 1, reservedUntil: null, stripeId });

    await expect(
      db.insert(orders).values({ id: randomUUID(), email: "dup@example.com", status: "pending", totalMinor: 10000, stripeId }),
    ).rejects.toThrow();
  });

  // the exact claim payAction runs before calling Stripe: one click can win, the other must not
  const claim = (id: string) =>
    db
      .update(orders)
      .set({ stripeId: `claim:${id}` })
      .where(and(eq(orders.id, id), isNull(orders.stripeId), eq(orders.status, "pending"), eq(orders.stockReleased, false)))
      .returning({ id: orders.id });

  it("the pay claim lets exactly one creator through", async () => {
    const orderId = await seedOrder({ qty: 1, reservedUntil: new Date(Date.now() + 35 * 60_000) });
    expect(await claim(orderId)).toHaveLength(1);
    expect(await claim(orderId)).toHaveLength(0);
  });

  it("the pay claim holds under a concurrent double click", async () => {
    const orderId = await seedOrder({ qty: 1, reservedUntil: new Date(Date.now() + 35 * 60_000) });
    const results = await Promise.all([claim(orderId), claim(orderId)]);
    expect(results.flat()).toHaveLength(1);
  });
});

describe("shipping transitions", () => {
  it("cannot move an order backwards, so a carrier cannot re-trigger notices", async () => {
    const { updateShipping } = await import("@/lib/admin");
    const { placeOrder } = await import("@/lib/orders");
    const { carts, cartItems } = await import("@/db/schema");
    await seedProduct(); // beforeEach already seeds; this call is idempotent
    const cartId = randomUUID();
    await db.insert(carts).values({ id: cartId });
    await db.insert(cartItems).values({ cartId, handle: HANDLE, qty: 1 });

    const placed = await placeOrder({ cartId, email: "ship@example.com", name: "Ship", address: "12 Somewhere Street" });
    expect(placed.ok).toBe(true);
    const orderId = (placed as { orderId: string }).orderId;
    await db.update(orders).set({ status: "paid", paid: true }).where(eq(orders.id, orderId));

    expect(await updateShipping(orderId, { carrier: "SMSA", trackingCode: "A1", status: "shipped" })).toBe("paid");
    expect(await updateShipping(orderId, { carrier: "SMSA", trackingCode: "A2", status: "processing" })).toBeNull();
    expect(await updateShipping(orderId, { carrier: "SMSA", trackingCode: "A3", status: "shipped" })).toBe("shipped");
    expect(await updateShipping(orderId, { carrier: "SMSA", trackingCode: "A4", status: "delivered" })).toBe("shipped");
  });
});

describe("refund", () => {
  it("restores stock exactly once and refuses the second call", async () => {
    const { refundOrder } = await import("@/lib/orders");
    await seedProduct();
    const orderId = randomUUID();
    await db.insert(orders).values({
      id: orderId,
      email: `refund-${orderId.slice(0, 8)}@example.com`,
      status: "paid",
      paid: true,
      totalMinor: 20000,
      reservedUntil: null,
      stockReleased: false,
    });
    await db.insert(orderItems).values({ id: randomUUID(), orderId, handle: HANDLE, title: "Reservation Fixture", qty: 2, priceMinor: 10000 });
    await db.update(products).set({ stock: 98 }).where(eq(products.handle, HANDLE));

    expect(await refundOrder(orderId, "manager@orris.local")).toBe(true);
    const [after] = await db.select({ stock: products.stock, status: orders.status, paid: orders.paid, released: orders.stockReleased }).from(products).innerJoin(orders, eq(orders.id, orderId)).where(eq(products.handle, HANDLE));
    expect(after).toEqual({ stock: 100, status: "refunded", paid: false, released: true });

    expect(await refundOrder(orderId, "manager@orris.local")).toBe(false);
    const [again] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, HANDLE));
    expect(again.stock).toBe(100); // no double restore
  });
});
