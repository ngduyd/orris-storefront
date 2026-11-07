import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reviews, users } from "@/db/schema";
import { deleteReview, listReviews, reviewStats, saveReview } from "@/lib/reviews";

const HANDLE = "mont-blanc-mont-blanc-explorer-100ml";
const userId = randomUUID();

afterAll(async () => {
  await db.delete(reviews).where(eq(reviews.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
});

describe("reviews", () => {
  it("tạo review rồi cập nhật: mỗi tài khoản một review", async () => {
    await db.insert(users).values({ id: userId, email: `test-${userId.slice(0, 8)}@example.com`, role: "customer" });

    await saveReview(HANDLE, userId, 5, "first");
    expect(await reviewStats(HANDLE)).toEqual({ avg: 5, count: 1 });

    await saveReview(HANDLE, userId, 3, "edited");
    const stats = await reviewStats(HANDLE);
    expect(stats.count).toBe(1);
    expect(stats.avg).toBe(3);

    const list = await listReviews(HANDLE);
    expect(list[0].body).toBe("edited");
  });

  it("xoá review đưa số liệu về 0", async () => {
    await deleteReview(HANDLE, userId);
    expect(await reviewStats(HANDLE)).toEqual({ avg: null, count: 0 });
  });
});

describe("verified purchase", () => {
  it("chưa mua thì không được coi là đã mua; đơn chưa trả cũng vậy", async () => {
    const { hasPurchased } = await import("@/lib/reviews");
    const { orderItems, orders } = await import("@/db/schema");
    const email = `buyer-${userId.slice(0, 8)}@example.com`;
    await db.update(users).set({ email }).where(eq(users.id, userId));

    expect(await hasPurchased(HANDLE, { id: userId, email })).toBe(false);

    const orderId = randomUUID();
    await db.insert(orders).values({ id: orderId, email, status: "pending", totalMinor: 1000, paid: false });
    await db.insert(orderItems).values({ id: randomUUID(), orderId, handle: HANDLE, title: "Explorer", qty: 1, priceMinor: 1000 });
    expect(await hasPurchased(HANDLE, { id: userId, email })).toBe(false);

    await db.update(orders).set({ paid: true, status: "paid" }).where(eq(orders.id, orderId));
    expect(await hasPurchased(HANDLE, { id: userId, email })).toBe(true);

    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));
  });
});
