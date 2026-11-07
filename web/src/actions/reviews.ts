"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { deleteReview, purchaseOrderId, saveReview } from "@/lib/reviews";
import { hit } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

export async function submitReviewAction(fd: FormData) {
  const handle = String(fd.get("handle") ?? "");
  const rating = Number(fd.get("rating"));
  const body = String(fd.get("body") ?? "").trim().slice(0, 2000);
  const authorName = String(fd.get("authorName") ?? "").trim().slice(0, 40) || null;
  const user = await currentUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(`/product/${handle}`)}`);
  if (hit(`review:${user.id}`, 10, HOUR)) redirect(`/product/${handle}?review=slow`);
  if (!handle || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`/product/${handle}?review=error`);
  }
  // verified purchase only: every review is anchored to a paid order
  const orderId = await purchaseOrderId(handle, user);
  if (!orderId) redirect(`/product/${handle}?review=notpurchased`);

  await saveReview(handle, user.id, rating, body, authorName, orderId);
  revalidatePath(`/product/${handle}`);
  revalidatePath("/shop");
  redirect(`/product/${handle}?review=saved#reviews`);
}

export async function deleteReviewAction(fd: FormData) {
  const handle = String(fd.get("handle") ?? "");
  const user = await currentUser();
  if (!user) redirect("/account/login");
  if (handle) await deleteReview(handle, user.id);
  revalidatePath(`/product/${handle}`);
  revalidatePath("/shop");
  redirect(`/product/${handle}?review=deleted#reviews`);
}
