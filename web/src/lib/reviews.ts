import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, reviews, users } from "@/db/schema";

export type ReviewStats = { avg: number | null; count: number };

export async function listReviews(handle: string, limit = 20) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      authorName: reviews.authorName,
      orderId: reviews.orderId,
      createdAt: reviews.createdAt,
      userId: reviews.userId,
      email: users.email,
      name: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.handle, handle))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function reviewStats(handle: string): Promise<ReviewStats> {
  const [row] = await db
    .select({ avg: sql<string | null>`avg(${reviews.rating})`, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.handle, handle));
  return { avg: row?.avg === null || row?.avg === undefined ? null : Number(row.avg), count: row?.count ?? 0 };
}

export async function myReview(handle: string, userId: string) {
  const [row] = await db.select().from(reviews).where(and(eq(reviews.handle, handle), eq(reviews.userId, userId))).limit(1);
  return row ?? null;
}

/** One review per account per product: submitting again edits it. */
export async function saveReview(handle: string, userId: string, rating: number, body: string, authorName: string | null, orderId: string) {
  await db
    .insert(reviews)
    .values({ id: randomUUID(), handle, userId, rating, body, authorName, orderId })
    .onConflictDoUpdate({ target: [reviews.handle, reviews.userId], set: { rating, body, authorName } }); // orderId stays from the first post
}

export async function deleteReview(handle: string, userId: string) {
  await db.delete(reviews).where(and(eq(reviews.handle, handle), eq(reviews.userId, userId)));
}

/** Review stats for a page of products, in one query. */
export async function statsFor(handles: string[]) {
  if (!handles.length) return new Map<string, ReviewStats>();
  const rows = await db
    .select({ handle: reviews.handle, avg: sql<string>`avg(${reviews.rating})`, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(inArray(reviews.handle, handles))
    .groupBy(reviews.handle);
  return new Map(rows.map((r) => [r.handle, { avg: Number(r.avg), count: r.count }]));
}

/** The paid order this account used to buy the handle (latest one), or null. */
export async function purchaseOrderId(handle: string, user: { id: string; email: string }) {
  const [row] = await db
    .select({ orderId: orders.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orderItems.handle, handle),
        eq(orders.paid, true),
        sql`(${orders.userId} = ${user.id} or lower(${orders.email}) = ${user.email.toLowerCase()})`,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return row?.orderId ?? null;
}

/** Kept for callers that only need the boolean. */
export async function hasPurchased(handle: string, user: { id: string; email: string }) {
  return Boolean(await purchaseOrderId(handle, user));
}
