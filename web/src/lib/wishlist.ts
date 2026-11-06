import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { wishlist } from "@/db/schema";

export async function toggleWishlist(userId: string, handle: string) {
  const [row] = await db
    .select({ handle: wishlist.handle })
    .from(wishlist)
    .where(and(eq(wishlist.userId, userId), eq(wishlist.handle, handle)))
    .limit(1);

  if (row) {
    await db.delete(wishlist).where(and(eq(wishlist.userId, userId), eq(wishlist.handle, handle)));
    return false;
  }
  await db.insert(wishlist).values({ userId, handle });
  return true;
}

export async function isWished(userId: string | null | undefined, handle: string) {
  if (!userId) return false;
  const [row] = await db
    .select({ handle: wishlist.handle })
    .from(wishlist)
    .where(and(eq(wishlist.userId, userId), eq(wishlist.handle, handle)))
    .limit(1);
  return Boolean(row);
}

export async function listWishlist(userId: string) {
  return db.select({ handle: wishlist.handle, addedAt: wishlist.createdAt }).from(wishlist).where(eq(wishlist.userId, userId)).orderBy(desc(wishlist.createdAt));
}

/** Tập handle đã lưu trong số handle đang hiển thị — 1 query cho cả lưới. */
export async function wishedIn(userId: string | null | undefined, handles: string[]) {
  if (!userId || !handles.length) return new Set<string>();
  const rows = await db
    .select({ handle: wishlist.handle })
    .from(wishlist)
    .where(and(eq(wishlist.userId, userId), inArray(wishlist.handle, handles)));
  return new Set(rows.map((r) => r.handle));
}
