"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { toggleWishlist } from "@/lib/wishlist";

export async function toggleWishlistAction(fd: FormData) {
  const handle = String(fd.get("handle") ?? "");
  const back = String(fd.get("back") ?? "/shop");
  const user = await currentUser();
  // not signed in: go through login and come back to the same page
  if (!user) redirect(`/account/login?next=${encodeURIComponent(back)}`);
  if (!handle) return;

  await toggleWishlist(user.id, handle);
  revalidatePath("/account/wishlist");
  revalidatePath(`/product/${handle}`);
}
