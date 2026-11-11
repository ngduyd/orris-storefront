import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { carts, orderItems, orders, products } from "@/db/schema";
import { addLine, readCart } from "@/lib/cart";
import { placeOrder } from "@/lib/orders";

/** A fresh address per checkout: the pending-order cap keys on email. */
const buyer = () => `buyer-${randomUUID().slice(0, 8)}@example.com`;

const H = "mont-blanc-mont-blanc-explorer-100ml";
const H2 = "givenchy-givenchy-l-interdit-50ml";
const cleanup: { cartId: string; orderIds: string[] }[] = [];
// baseline chụp 1 lần trước mọi test; afterAll trả đúng giá trị này (ghi đè theo thứ tự sẽ sai)
const baseline = new Map<string, number>(
  (await db.select({ h: products.handle, s: products.stock }).from(products).where(inArray(products.handle, [H, H2]))).map(
    (r) => [r.h, r.s],
  ),
);

async function freshCart() {
  // stock phải do test tự đặt: dữ liệu demo có thể đã bị các lần chạy trước trừ về 0
  await db.update(products).set({ stock: 100 }).where(inArray(products.handle, [H, H2]));
  const cartId = randomUUID();
  const rec = { cartId, orderIds: [] as string[] };
  cleanup.push(rec);
  await db.insert(carts).values({ id: cartId });
  return rec;
}

afterAll(async () => {
  for (const [handle, stock] of baseline) {
    await db.update(products).set({ stock }).where(eq(products.handle, handle));
  }
  for (const c of cleanup) {
    if (c.orderIds.length) await db.delete(orderItems).where(inArray(orderItems.orderId, c.orderIds));
    if (c.orderIds.length) await db.delete(orders).where(inArray(orders.id, c.orderIds));
    await db.delete(carts).where(eq(carts.id, c.cartId));
  }
});

describe("placeOrder", () => {
  it("tính total từ giá DB và ghi order_items", async () => {
    const c = await freshCart();
    await addLine(c.cartId, H, 2);
    await addLine(c.cartId, H2, 1);

    const prices = await db
      .select({ h: products.handle, p: products.priceMinor })
      .from(products)
      .where(inArray(products.handle, [H, H2]));
    const expected = prices.reduce((s, r) => s + (r.h === H ? r.p * 2 : r.p), 0);

    const res = await placeOrder({ cartId: c.cartId, email: buyer(), name: "Test", address: "Somewhere 1" });
    if (!res.ok) throw new Error(res.error);
    c.orderIds.push(res.orderId);

    expect(res.totalMinor).toBe(expected);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, res.orderId));
    expect(items).toHaveLength(2);
    const [order] = await db.select().from(orders).where(eq(orders.id, res.orderId));
    expect(order.status).toBe("pending");
    expect(order.totalMinor).toBe(expected);
  });

  it("trừ stock và làm rỗng giỏ", async () => {
    const c = await freshCart();
    const [before] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, H));
    await addLine(c.cartId, H, 3);
    const res = await placeOrder({ cartId: c.cartId, email: buyer(), name: "Test", address: "Somewhere 1" });
    if (!res.ok) throw new Error(res.error);
    c.orderIds.push(res.orderId);

    const [after] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, H));
    expect(after.stock).toBe(before.stock - 3);
    expect((await readCart(c.cartId)).count).toBe(0);
  });

  it("giỏ rỗng -> EMPTY_CART, không tạo order", async () => {
    const c = await freshCart();
    const res = await placeOrder({ cartId: c.cartId, email: buyer(), name: "Test", address: "Somewhere 1" });
    expect(res).toEqual({ ok: false, error: "EMPTY_CART" });
  });

  it("vượt stock -> OUT_OF_STOCK, không trừ kho", async () => {
    const c = await freshCart();
    await addLine(c.cartId, H2, 1);
    await db.update(products).set({ stock: 0 }).where(eq(products.handle, H2));

    const res = await placeOrder({ cartId: c.cartId, email: buyer(), name: "Test", address: "Somewhere 1" });
    expect(res).toEqual({ ok: false, error: "OUT_OF_STOCK" });

    const [after] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, H2));
    expect(after.stock).toBe(0);
  });
});

describe("duplicate submit & concurrency", () => {
  it("submit lần 2 cùng cart -> EMPTY_CART, không tạo đơn thứ hai", async () => {
    const c = await freshCart();
    await addLine(c.cartId, H, 1);
    const input = { cartId: c.cartId, email: buyer(), name: "Test", address: "Somewhere 1" };
    const first = await placeOrder(input);
    const second = await placeOrder(input);
    if (!first.ok) throw new Error(first.error);
    c.orderIds.push(first.orderId);
    expect(second).toEqual({ ok: false, error: "EMPTY_CART" });
  });

  it("2 request song song -> chỉ 1 đơn, stock không âm", async () => {
    const c = await freshCart();
    await db.update(products).set({ stock: 1 }).where(eq(products.handle, H2));
    await addLine(c.cartId, H2, 1);

    const input = { cartId: c.cartId, email: buyer(), name: "Test", address: "Somewhere 1" };
    const results = await Promise.all([placeOrder(input), placeOrder(input)]);
    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(1);
    for (const r of ok) if (r.ok) c.orderIds.push(r.orderId);
    const [after] = await db.select({ stock: products.stock }).from(products).where(eq(products.handle, H2));
    expect(after.stock).toBe(0);
  });
});
