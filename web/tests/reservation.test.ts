import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, orderItems, orders, products } from "@/db/schema";
import { cancelOrder, markPaid, releaseExpiredReservations } from "@/lib/orders";

// Fixture product, never the seeded catalogue: these tests move real stock.
const HANDLE = `test-reserve-${randomUUID().slice(0, 8)}`;
const STOCK = 100;
const orderIds: string[] = [];

async function seedProduct() {
  await db.insert(products).values({
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
  });
}

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
    await seedProduct();
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
});

describe("one checkout session per order", () => {
  it("a second order with the same stripe_id is rejected by the unique index", async () => {
    const stripeId = `cs_test_dup_${randomUUID().slice(0, 8)}`;
    await seedOrder({ qty: 1, reservedUntil: null, stripeId });

    await expect(
      db.insert(orders).values({ id: randomUUID(), email: "dup@example.com", status: "pending", totalMinor: 10000, stripeId }),
    ).rejects.toThrow();
  });
});
