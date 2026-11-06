import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { carts } from "@/db/schema";
import { ensureCart, readCart, type CartLine } from "./cart";
import { isHttps } from "./cookie-secure";

const COOKIE = "cart_id";
const COUNT_COOKIE = "cart_n"; // bản sao đọc được từ client, chỉ để hiện số trên header
const MAX_AGE = 60 * 60 * 24 * 30;

/** Chỉ đọc cookie: RSC không được set cookie. */
export async function currentCart(): Promise<{ cartId: string | null; lines: CartLine[]; totalMinor: number; count: number }> {
  const cartId = (await cookies()).get(COOKIE)?.value ?? null;
  return { cartId, ...(await readCart(cartId)) };
}

/** Chỉ gọi trong Server Action hoặc Route Handler. */
export async function ensureCartCookie(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) {
    const [row] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, existing)).limit(1);
    if (row) return row.id;
  }
  const cartId = randomUUID();
  await ensureCart(cartId); // row phải tồn tại trước khi cookie được ghi
  store.set(COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: MAX_AGE,
  });
  return cartId;
}

/** Ghi số lượng ra cookie không httpOnly để header hiện badge mà không cần render động. */
export async function setCountCookie(cartId: string) {
  const { count } = await readCart(cartId);
  (await cookies()).set(COUNT_COOKIE, String(count), { path: "/", maxAge: MAX_AGE, sameSite: "lax" });
}
