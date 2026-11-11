import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";
import { canRequestReturn, decideReturn, requestReturn } from "@/lib/orders";

// Dùng sản phẩm riêng để không phụ thuộc dữ liệu thật trong DB dev.
const HANDLE = `test-return-${randomUUID().slice(0, 8)}`;
const created: string[] = [];

async function seedProduct(stock = 100) {
  await db
    .insert(products)
    .values({
      handle: HANDLE,
      title: "Return Fixture",
      brand: "Fixture",
      gender: "Unisex",
      sizeMl: 50,
      priceMinor: 10000,
      notes: { top: [], mid: [], base: [] },
      image: "fixture.webp",
      status: "active",
      stock,
    })
    .onConflictDoUpdate({ target: products.handle, set: { stock } });
}

async function seedOrder(status: string, paid: boolean, qty = 2) {
  const orderId = randomUUID();
  created.push(orderId);
  await db.insert(orders).values({
    id: orderId,
    email: `ret-${orderId.slice(0, 8)}@example.com`,
    status: status as "delivered",
    paid,
    totalMinor: 10000 * qty,
    reservedUntil: null,
    stockReleased: false,
  });
  await db.insert(orderItems).values({ id: randomUUID(), orderId, handle: HANDLE, title: "Return Fixture", qty, priceMinor: 10000 });
  return orderId;
}

async function read(orderId: string) {
  const [order] = await db
    .select({
      status: orders.status,
      paid: orders.paid,
      returnStatus: orders.returnStatus,
      reason: orders.returnReason,
      released: orders.stockReleased,
    })
    .from(orders)
    .where(eq(orders.id, orderId));
  const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, HANDLE));
  return { ...order, stock: product.stock };
}

afterAll(async () => {
  if (created.length) await db.delete(orderItems).where(inArray(orderItems.orderId, created));
  if (created.length) await db.delete(orders).where(inArray(orders.id, created));
  await db.delete(products).where(eq(products.handle, HANDLE));
});

describe("who may ask for a return", () => {
  it("only a delivered, paid order with no request yet", () => {
    const base = { status: "delivered", paid: true, returnStatus: null };
    expect(canRequestReturn(base)).toBe(true);
    expect(canRequestReturn({ ...base, status: "shipped" })).toBe(false); // still in transit
    expect(canRequestReturn({ ...base, status: "pending" })).toBe(false);
    expect(canRequestReturn({ ...base, paid: false })).toBe(false); // nothing to refund
    expect(canRequestReturn({ ...base, returnStatus: "requested" })).toBe(false); // one at a time
    expect(canRequestReturn({ ...base, returnStatus: "rejected" })).toBe(false);
  });
});

describe("requesting a return", () => {
  it("records the reason once and refuses a second request", async () => {
    await seedProduct();
    const orderId = await seedOrder("delivered", true);

    expect(await requestReturn(orderId, "buyer@example.com", "  bottle arrived cracked  ")).toBe(true);
    const after = await read(orderId);
    expect(after.returnStatus).toBe("requested");
    expect(after.reason).toBe("bottle arrived cracked"); // trimmed
    expect(after.paid).toBe(true); // no money moved yet: a manager decides
    expect(after.stock).toBe(100);

    expect(await requestReturn(orderId, "buyer@example.com", "again")).toBe(false);
    expect((await read(orderId)).reason).toBe("bottle arrived cracked");
  });

  it("refuses an order that was never paid or never arrived", async () => {
    await seedProduct();
    const unpaid = await seedOrder("delivered", false);
    const inTransit = await seedOrder("shipped", true);
    expect(await requestReturn(unpaid, "x@example.com", "why")).toBe(false);
    expect(await requestReturn(inTransit, "x@example.com", "why")).toBe(false);
    expect((await read(unpaid)).returnStatus).toBeNull();
    expect((await read(inTransit)).returnStatus).toBeNull();
  });
});

describe("deciding a return", () => {
  it("approving refunds the card, restores the stock and closes the order", async () => {
    await seedProduct(98); // two units are out with the customer
    const orderId = await seedOrder("delivered", true, 2);
    await requestReturn(orderId, "buyer@example.com", "not for me");

    expect(await decideReturn(orderId, "manager@orris.local", true)).toBe(true);
    const after = await read(orderId);
    expect(after).toEqual({
      status: "refunded",
      paid: false,
      returnStatus: "approved",
      reason: "not for me",
      released: true,
      stock: 100,
    });

    // the decision is a one-shot: a second click cannot refund twice
    expect(await decideReturn(orderId, "manager@orris.local", true)).toBe(false);
    expect((await read(orderId)).stock).toBe(100);
  });

  it("rejecting leaves the order delivered and the money untouched", async () => {
    await seedProduct(98);
    const orderId = await seedOrder("delivered", true, 2);
    await requestReturn(orderId, "buyer@example.com", "changed my mind");

    expect(await decideReturn(orderId, "manager@orris.local", false)).toBe(true);
    const after = await read(orderId);
    expect(after).toEqual({
      status: "delivered",
      paid: true,
      returnStatus: "rejected",
      reason: "changed my mind",
      released: false,
      stock: 98,
    });
  });

  it("cannot decide a return nobody asked for", async () => {
    await seedProduct();
    const orderId = await seedOrder("delivered", true);
    expect(await decideReturn(orderId, "manager@orris.local", true)).toBe(false);
    expect((await read(orderId)).status).toBe("delivered");
  });
});
