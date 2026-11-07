import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts, products } from "@/db/schema";

export type CartLine = {
  handle: string;
  qty: number;
  title: string;
  brand: string;
  sizeMl: number;
  priceMinor: number;
  image: string;
  stock: number;
};

/** Create an empty cart with the given id; reuse it when it already exists. */
export async function ensureCart(cartId: string, userId?: string) {
  await db.insert(carts).values({ id: cartId, userId: userId ?? null }).onConflictDoNothing();
  return cartId;
}

/** Tie the anonymous cart to the signed-in buyer. */
export async function attachCartUser(cartId: string, userId: string) {
  await db.update(carts).set({ userId }).where(eq(carts.id, cartId));
}

export async function addLine(cartId: string, handle: string, qty = 1) {
  await ensureCart(cartId);
  await db
    .insert(cartItems)
    .values({ cartId, handle, qty })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.handle],
      set: { qty: sql`least(${cartItems.qty} + ${qty}, 99)` },
    });
}

/** qty <= 0 removes the line. */
export async function setLine(cartId: string, handle: string, qty: number) {
  if (qty <= 0) return removeLine(cartId, handle);
  await db
    .insert(cartItems)
    .values({ cartId, handle, qty: Math.min(qty, 99) })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.handle],
      set: { qty: Math.min(qty, 99) },
    });
}

export async function removeLine(cartId: string, handle: string) {
  await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.handle, handle)));
}

export async function clearCart(cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

export async function readCart(cartId: string | null): Promise<{ lines: CartLine[]; totalMinor: number; count: number }> {
  if (!cartId) return { lines: [], totalMinor: 0, count: 0 };
  const raw = await db
    .select({
      handle: cartItems.handle,
      qty: cartItems.qty,
      title: products.title,
      brand: products.brand,
      sizeMl: products.sizeMl,
      priceMinor: products.priceMinor,
      image: products.image,
      images: products.images,
      stock: products.stock,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.handle, cartItems.handle))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(products.brand, products.title);

  const rows = raw.map(({ images, ...r }) => ({ ...r, image: images[0] || r.image }));

  return {
    lines: rows,
    totalMinor: rows.reduce((s, r) => s + r.priceMinor * r.qty, 0),
    count: rows.reduce((s, r) => s + r.qty, 0),
  };
}
