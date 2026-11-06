"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addLine, removeLine, setLine } from "@/lib/cart";
import { ensureCartCookie, setCountCookie } from "@/lib/cart-cookie";

const refresh = () => {
  revalidatePath("/cart");
  revalidatePath("/", "layout");
};

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string, fallback = 0) => {
  const n = Number(fd.get(k));
  return Number.isInteger(n) ? n : fallback;
};

export async function addToCartAction(fd: FormData) {
  const handle = str(fd, "handle");
  if (!handle) return;
  const cartId = await ensureCartCookie();
  await addLine(cartId, handle, Math.max(1, int(fd, "qty", 1)));
  await setCountCookie(cartId);
  refresh();
  redirect("/cart"); // phản hồi rõ ràng: không có JS thì đây là tín hiệu duy nhất
}

export async function setQtyAction(fd: FormData) {
  const handle = str(fd, "handle");
  if (!handle) return;
  const cartId = await ensureCartCookie();
  await setLine(cartId, handle, int(fd, "qty"));
  await setCountCookie(cartId);
  refresh();
}

export async function removeAction(fd: FormData) {
  const handle = str(fd, "handle");
  if (!handle) return;
  const cartId = await ensureCartCookie();
  await removeLine(cartId, handle);
  await setCountCookie(cartId);
  refresh();
}
