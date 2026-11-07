import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, reviews, users } from "@/db/schema";
import { deleteReview, listReviews, purchaseOrderId, reviewStats, saveReview } from "@/lib/reviews";

// Dùng sản phẩm riêng để không phụ thuộc dữ liệu thật trong DB dev.
const HANDLE = `test-review-${randomUUID().slice(0, 8)}`;
const userA = randomUUID();
const userB = randomUUID();
const emailA = `ra-${userA.slice(0, 8)}@example.com`;
const emailB = `rb-${userB.slice(0, 8)}@example.com`;

async function seedProduct() {
  await db.insert(products).values({
    handle: HANDLE,
    title: "Review Fixture",
    brand: "Fixture",
    gender: "Unisex",
    sizeMl: 50,
    priceMinor: 10000,
    notes: { top: ["a"], mid: ["b"], base: ["c"] },
    image: "fixture.webp",
    status: "active",
  });
}

async function seedUser(id: string, email: string) {
  await db.insert(users).values({ id, email, role: "customer" });
}

async function seedOrder(userId: string, email: string, paid: boolean) {
  const orderId = randomUUID();
  await db.insert(orders).values({ id: orderId, userId, email, status: paid ? "paid" : "pending", paid, totalMinor: 10000 });
  await db.insert(orderItems).values({ id: randomUUID(), orderId, handle: HANDLE, title: "Review Fixture", qty: 1, priceMinor: 10000 });
  return orderId;
}

afterAll(async () => {
  const ids = [userA, userB];
  const orderRows = await db.select({ id: orders.id }).from(orders).where(inArray(orders.userId, ids));
  if (orderRows.length) await db.delete(orderItems).where(inArray(orderItems.orderId, orderRows.map((o) => o.id)));
  await db.delete(orders).where(inArray(orders.userId, ids));
  await db.delete(reviews).where(inArray(reviews.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  await db.delete(products).where(eq(products.handle, HANDLE));
});

describe("reviews", () => {
  it("review gắn với đơn đã trả; mỗi tài khoản một review", async () => {
    await seedProduct();
    await seedUser(userA, emailA);
    const orderId = await seedOrder(userA, emailA, true);

    expect(await purchaseOrderId(HANDLE, { id: userA, email: emailA })).toBe(orderId);

    await saveReview(HANDLE, userA, 5, "first", "Duy", orderId);
    expect(await reviewStats(HANDLE)).toEqual({ avg: 5, count: 1 });

    const [review] = await listReviews(HANDLE);
    expect(review.orderId).toBe(orderId);
    expect(review.authorName).toBe("Duy");

    // post lại = sửa, không tạo thêm
    await saveReview(HANDLE, userA, 3, "edited", "Duy", orderId);
    expect(await reviewStats(HANDLE)).toEqual({ avg: 3, count: 1 });
    expect((await listReviews(HANDLE))[0].body).toBe("edited");
  });

  it("đơn chưa trả thì không có đơn để gắn review", async () => {
    await seedUser(userB, emailB);
    await seedOrder(userB, emailB, false);
    expect(await purchaseOrderId(HANDLE, { id: userB, email: emailB })).toBeNull();
  });

  it("xoá review đưa số liệu về 0", async () => {
    await deleteReview(HANDLE, userA);
    expect(await reviewStats(HANDLE)).toEqual({ avg: null, count: 0 });
  });
});
