"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, requireStaff, setUserDisabled } from "@/lib/auth";
import { cancelOrder, decideReturn, refundOrder } from "@/lib/orders";
import { sendOrderClosed, sendShippingNotice } from "@/lib/bill";
import {
  brandExists,
  getAdminProduct,
  getOrderDetail,
  imageUsedElsewhere,
  renameBrand,
  setOrderStatus,
  setReviewHidden,
  setUserRole,
  updateProductRow,
  updateShipping,
  type OrderStatus,
} from "@/lib/admin";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requestOrigin } from "@/lib/origin";
import { writeAudit } from "@/lib/audit";
import { deleteImage } from "@/lib/upload";
import { orderStatus } from "@/db/schema";

const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;

export async function saveProductAction(fd: FormData) {
  const actor = await requireManager();
  const handle = String(fd.get("handle") ?? "");
  const back = `/admin/products/${encodeURIComponent(handle)}`;
  if (!handle) redirect("/admin/products");

  const num = (k: string) => Number(String(fd.get(k) ?? "").replace(",", "."));
  const priceSar = num("price");
  const compareSarRaw = String(fd.get("compareAt") ?? "").trim();
  const compareSar = compareSarRaw === "" ? null : num("compareAt");
  const stock = Number(fd.get("stock"));
  const sizeMl = Number(fd.get("sizeMl"));
  const status = String(fd.get("status") ?? "");
  const title = String(fd.get("title") ?? "").trim().slice(0, 200);
  const brand = String(fd.get("brand") ?? "").trim().slice(0, 120);
  const allowNewBrand = String(fd.get("newBrand") ?? "") === "on";
  const imagesRaw = String(fd.get("images") ?? "").trim();
  let images: string[] = [];
  try {
    const parsed = JSON.parse(imagesRaw || "[]");
    if (Array.isArray(parsed)) images = parsed.filter((v): v is string => typeof v === "string").map((v) => v.trim().slice(0, 200)).filter(Boolean).slice(0, 12);
  } catch {
    images = [];
  }
  const description = String(fd.get("description") ?? "").trim().slice(0, 5000) || null;

  const bad =
    !title || !brand || !images.length ||
    !Number.isFinite(priceSar) || priceSar < 0 ||
    (compareSar !== null && (!Number.isFinite(compareSar) || compareSar < 0)) ||
    !Number.isInteger(stock) || stock < 0 ||
    !Number.isInteger(sizeMl) || sizeMl <= 0 ||
    !(PRODUCT_STATUSES as readonly string[]).includes(status);
  if (bad) redirect(`${back}?error=1`);
  // an unknown brand may only be created when explicitly confirmed, so typos do not spawn brands
  if (!(await brandExists(brand)) && !allowNewBrand) redirect(`${back}?error=brand`);

  const before = await getAdminProduct(handle);
  await updateProductRow(handle, {
    title,
    brand,
    sizeMl,
    priceMinor: Math.round(priceSar * 100),
    // compare-at only means something when it exceeds the sale price
    compareAtMinor: compareSar !== null && Math.round(compareSar * 100) > Math.round(priceSar * 100) ? Math.round(compareSar * 100) : null,
    stock,
    status: status as (typeof PRODUCT_STATUSES)[number],
    image: images[0],
    images,
    description,
  });

  // images dropped in this edit (or the file behind them) would otherwise leak forever
  if (before) {
    const kept = new Set(images);
    for (const old of before.images) if (!kept.has(old) && !(await imageUsedElsewhere(old, handle))) await deleteImage(old);
  }

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.update",
    targetType: "product",
    targetId: handle,
    detail: before
      ? [
          before.title !== title ? `title "${before.title}" -> "${title}"` : null,
          before.brand !== brand ? `brand ${before.brand} -> ${brand}` : null,
          before.sizeMl !== sizeMl ? `size ${before.sizeMl} -> ${sizeMl}` : null,
          before.priceMinor !== Math.round(priceSar * 100) ? `price ${before.priceMinor / 100} -> ${priceSar}` : null,
          before.stock !== stock ? `stock ${before.stock} -> ${stock}` : null,
          before.status !== status ? `status ${before.status} -> ${status}` : null,
          before.images.join(",") !== images.join(",") ? `images [${before.images.length}] -> [${images.length}]` : null,
        ].filter(Boolean).join(", ") || "no field changed"
      : undefined,
  });

  revalidatePath("/admin/products");
  revalidatePath(`/product/${handle}`);
  revalidatePath("/shop");
  updateTag("products"); // server action: expire the cached catalogue immediately
  redirect(`${back}?saved=1`);
}

export async function endSaleAction(fd: FormData) {
  const actor = await requireManager();
  const handle = String(fd.get("handle") ?? "");
  const before = handle ? await getAdminProduct(handle) : null;
  if (!before) redirect("/admin/products");

  if (before.compareAtMinor !== null && before.compareAtMinor > before.priceMinor) {
    await updateProductRow(handle, {
      title: before.title,
      brand: before.brand,
      sizeMl: before.sizeMl,
      priceMinor: before.compareAtMinor,
      compareAtMinor: null,
      stock: before.stock,
      status: before.status,
      image: before.image,
      images: before.images,
      description: before.description,
    });
    await writeAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "product.update",
      targetType: "product",
      targetId: handle,
      detail: `sale ended, price ${before.priceMinor / 100} -> ${before.compareAtMinor / 100}`,
    });
  }

  revalidatePath("/admin/products");
  revalidatePath(`/product/${handle}`);
  revalidatePath("/shop");
  updateTag("products"); // server action: expire the cached catalogue immediately
  redirect(`/admin/products/${encodeURIComponent(handle)}?saved=1`);
}

export async function saveOrderStatusAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!id || !(orderStatus.enumValues as readonly string[]).includes(status)) redirect("/admin/orders");
  // cancelled/refunded restore stock and move money: only cancelOrder/refundOrder may do that
  if (status === "cancelled" || status === "refunded") redirect(`/admin/orders/${encodeURIComponent(id)}?error=nosharef`);
  await setOrderStatus(id, status as OrderStatus);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "order.status", targetType: "order", targetId: id, detail: `status -> ${status}` });
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${encodeURIComponent(id)}?saved=1`);
}

/** Refuses a paid order (that comes back as a refund, not a cancellation) and a second cancel. */
export async function cancelOrderAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  if (!id) redirect("/admin/orders");
  const ok = await cancelOrder(id, actor.email);
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${encodeURIComponent(id)}?${ok ? "saved=1" : "error=nocancel"}`);
}

export async function refundOrderAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  if (!id) redirect("/admin/orders");
  const ok = await refundOrder(id, actor.email);
  if (ok) {
    await sendOrderClosed(id, await requestOrigin(), "refunded");
  }
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${encodeURIComponent(id)}?${ok ? "saved=1" : "error=norefund"}`);
}

/** Approve a return (refund + restock) or reject it. Only a manager moves money. */
export async function decideReturnAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  if (!id) redirect("/admin/orders");
  const approve = String(fd.get("decision") ?? "") === "approve";
  const ok = await decideReturn(id, actor.email, approve);
  if (ok && approve) await sendOrderClosed(id, await requestOrigin(), "refunded");
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${encodeURIComponent(id)}?${ok ? "saved=1" : "error=noreturn"}`);
}

/** Carrier (or manager) updates carrier, tracking code and shipping status. */
export async function saveShippingAction(fd: FormData) {
  const staff = await requireStaff();
  const id = String(fd.get("id") ?? "");
  const carrier = String(fd.get("carrier") ?? "").trim().slice(0, 80);
  const trackingCode = String(fd.get("trackingCode") ?? "").trim().slice(0, 80);
  const status = String(fd.get("status") ?? "");
  const allowed = ["processing", "shipped", "delivered"];
  if (!id || !allowed.includes(status)) redirect("/admin/orders?error=1");

  // shipping only makes sense once the order is paid and still alive
  const before = await getOrderDetail(id);
  const shippable = ["paid", "processing", "shipped", "delivered"];
  if (!before || !shippable.includes(before.order.status)) redirect(`/admin/orders/${encodeURIComponent(id)}?error=shipping`);

  const moved = await updateShipping(id, { carrier: carrier || null, trackingCode: trackingCode || null, status: status as OrderStatus });
  if (!moved) redirect(`/admin/orders/${encodeURIComponent(id)}?error=shipping`);
  // the customer hears about a shipment only when the status actually moves forward, and the
  // claim row makes that true across restarts (no Redis needed for a single instance)
  if (status !== before.order.status && (status === "shipped" || status === "delivered")) {
    const [claimed] = await db
      .update(orders)
      .set({ shippingNotifiedStatus: status, shippingNotifiedAt: new Date() })
      .where(and(eq(orders.id, id), ne(orders.shippingNotifiedStatus, status)))
      .returning({ id: orders.id });
    if (claimed) {
      await sendShippingNotice(id, await requestOrigin());
    }
  }
  await writeAudit({
    actorId: staff.id,
    actorEmail: staff.email,
    action: "order.shipping",
    targetType: "order",
    targetId: id,
    detail: `${status}${carrier ? ` · ${carrier}` : ""}${trackingCode ? ` · ${trackingCode}` : ""} (${staff.role})`,
  });
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${encodeURIComponent(id)}?saved=1&by=${staff.role}`);
}

export async function renameBrandAction(fd: FormData) {
  const actor = await requireManager();
  const from = String(fd.get("from") ?? "").trim();
  const to = String(fd.get("to") ?? "").trim().slice(0, 120);
  if (!from || !to) redirect("/admin/brands?error=1");

  const changed = await renameBrand(from, to);
  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "brand.rename",
    targetType: "brand",
    targetId: from,
    detail: `${from} -> ${to} (${changed} products)`,
  });
  revalidatePath("/admin/brands");
  revalidatePath("/shop");
  redirect("/admin/brands?saved=1");
}

export async function saveUserRoleAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  const role = String(fd.get("role") ?? "");
  const allowed = ["customer", "manager", "carrier"] as const;
  if (!id || !(allowed as readonly string[]).includes(role)) redirect("/admin/users?error=1");
  if (id === actor.id) redirect("/admin/users?error=self"); // never demote yourself

  await setUserRole(id, role as (typeof allowed)[number]);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.role", targetType: "user", targetId: id, detail: `role -> ${role}` });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}

export async function setUserBlockedAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  const blocked = String(fd.get("blocked") ?? "") === "1";
  if (!id) redirect("/admin/users?error=1");
  if (id === actor.id) redirect("/admin/users?error=self"); // never lock yourself out

  await setUserDisabled(id, blocked);
  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: blocked ? "user.disabled" : "user.enabled",
    targetType: "user",
    targetId: id,
    detail: blocked ? "account blocked, sessions ended" : "account unblocked",
  });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}

export async function toggleReviewHiddenAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  const hide = String(fd.get("hide") ?? "") === "1";
  const handle = id ? await setReviewHidden(id, hide) : null;
  if (!handle) redirect("/admin/reviews?error=1");

  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: hide ? "review.hide" : "review.show",
    targetType: "review",
    targetId: id,
    detail: `${handle} · ${hide ? "hidden" : "shown"}`,
  });
  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${handle}`);
  revalidatePath("/shop");
  revalidatePath("/");
  redirect("/admin/reviews?saved=1");
}
