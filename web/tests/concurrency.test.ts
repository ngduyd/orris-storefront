import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts, orderItems, orders, products } from "@/db/schema";
import { placeOrder, releaseExpiredReservations } from "@/lib/orders";

const HANDLE = `test-race-${randomUUID().slice(0, 8)}`;
const STOCK = 5;
const BUYERS = 20;
const cartIds: string[] = [];

async function newCart(qty = 1) {
  const cartId = randomUUID();
  cartIds.push(cartId);
  await db.insert(carts).values({ id: cartId });
  await db.insert(cartItems).values({ cartId, handle: HANDLE, qty });
  return cartId;
}

afterAll(async () => {
  const ids = await db.select({ id: orders.id }).from(orders).where(sql`${orders.email} like 'race-%'`);
  if (ids.length) await db.delete(orderItems).where(inArray(orderItems.orderId, ids.map((o) => o.id)));
  await db.delete(orders).where(sql`${orders.email} like 'race-%'`);
  if (cartIds.length) await db.delete(carts).where(inArray(carts.id, cartIds));
  await db.delete(products).where(eq(products.handle, HANDLE));
});

describe("checkout under contention", () => {
  it(`${BUYERS} buyers, ${STOCK} in stock: exactly ${STOCK} orders, never negative`, async () => {
    await db.insert(products).values({
      handle: HANDLE,
      title: "Race Fixture",
      brand: "Fixture",
      gender: "Unisex",
      sizeMl: 50,
      priceMinor: 10000,
      notes: { top: [], mid: [], base: [] },
      image: "fixture.webp",
      status: "active",
      stock: STOCK,
    });

    const cartIds = await Promise.all(Array.from({ length: BUYERS }, () => newCart(1)));

    const results = await Promise.all(
      cartIds.map((cartId, i) =>
        placeOrder({ cartId, email: `race-${i}-${HANDLE}@example.com`, name: "Racer", address: "Somewhere 1" }),
      ),
    );

    const won = results.filter((r) => r.ok);
    const lost = results.filter((r) => !r.ok);

    expect(won.length).toBe(STOCK);
    expect(lost.length).toBe(BUYERS - STOCK);
    expect(lost.every((r) => !r.ok && r.error === "OUT_OF_STOCK")).toBe(true);

    const [after] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, HANDLE));
    expect(after.stock).toBe(0);

    // one pending order per winner, so the shelf equals the money owed
    const pending = await db.select({ id: orders.id }).from(orders)
      .where(sql`${orders.email} like 'race-%' and ${orders.status} = 'pending'`);
    expect(pending.length).toBe(STOCK);
  }, 60_000);

  it("a second buyer for the same last unit loses instead of overselling", async () => {
    const cartId = await newCart(1);
    const res = await placeOrder({ cartId, email: `race-late-${HANDLE}@example.com`, name: "Late", address: "Somewhere 1" });
    expect(res).toEqual({ ok: false, error: "OUT_OF_STOCK" });
  });

  it("refuses more than three unpaid orders for one address", async () => {
    await db.update(products).set({ stock: 10 }).where(eq(products.handle, HANDLE));
    const email = `race-cap-${HANDLE}@example.com`;
    for (let i = 0; i < 3; i++) {
      const cartId = await newCart(1);
      expect((await placeOrder({ cartId, email, name: "Hoarder", address: "Somewhere 1" })).ok).toBe(true);
    }
    const res = await placeOrder({ cartId: await newCart(1), email, name: "Hoarder", address: "Somewhere 1" });
    expect(res).toEqual({ ok: false, error: "TOO_MANY_PENDING" });
  });

  it("the sweep runs once even when several callers fire together", async () => {
    const [row] = await db.select({ id: orders.id }).from(orders)
      .where(sql`${orders.email} like 'race-%' and ${orders.status} = 'pending'`).limit(1);
    await db.update(orders).set({ reservedUntil: sql`now() - interval '1 minute'` }).where(eq(orders.id, row.id));

    const [before] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, HANDLE));

    const swept = await Promise.all(Array.from({ length: 8 }, () => releaseExpiredReservations()));
    expect(swept.filter((n) => n > 0).length).toBeLessThanOrEqual(1); // the advisory lock is the gate

    const [after] = await db
      .select({ status: orders.status, released: orders.stockReleased })
      .from(orders).where(eq(orders.id, row.id));
    expect(after).toEqual({ status: "cancelled", released: true });

    // the single unit came back exactly once, not once per caller
    const [prod] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, HANDLE));
    expect(prod.stock).toBe(before.stock + 1);
  });
});
