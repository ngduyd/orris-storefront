import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { carts } from "@/db/schema";
import { ensureCart, readCart, type CartLine } from "./cart";
import { isHttps } from "./cookie-secure";

const COOKIE = "cart_id";
const COUNT_COOKIE = "cart_n"; // client-readable copy, only used for the header badge
const MAX_AGE = 60 * 60 * 24 * 30;

/** Read-only cookie access: RSC must not set cookies. */
export async function currentCart(): Promise<{ cartId: string | null; lines: CartLine[]; totalMinor: number; count: number }> {
  const cartId = (await cookies()).get(COOKIE)?.value ?? null;
  return { cartId, ...(await readCart(cartId)) };
}

/** Only call from a Server Action or Route Handler. */
export async function ensureCartCookie(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) {
    const [row] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, existing)).limit(1);
    if (row) return row.id;
  }
  const cartId = randomUUID();
  await ensureCart(cartId); // the row must exist before the cookie is written
  store.set(COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: MAX_AGE,
  });
  return cartId;
}

/** Write the item count to a non-httpOnly cookie so the header can show a badge without dynamic rendering. */
export async function setCountCookie(cartId: string) {
  const { count } = await readCart(cartId);
  (await cookies()).set(COUNT_COOKIE, String(count), { path: "/", maxAge: MAX_AGE, sameSite: "lax" });
}
