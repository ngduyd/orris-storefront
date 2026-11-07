"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { deleteReview, hasPurchased, saveReview } from "@/lib/reviews";

export async function submitReviewAction(fd: FormData) {
  const handle = String(fd.get("handle") ?? "");
  const rating = Number(fd.get("rating"));
  const body = String(fd.get("body") ?? "").trim().slice(0, 2000);
  const user = await currentUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(`/product/${handle}`)}`);
  if (!handle || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`/product/${handle}?review=error`);
  }
  // verified purchase only: reviews must be anchored to a paid order
  if (!(await hasPurchased(handle, user))) {
    redirect(`/product/${handle}?review=notpurchased`);
  }

  await saveReview(handle, user.id, rating, body);
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
