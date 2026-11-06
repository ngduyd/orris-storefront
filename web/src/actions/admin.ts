"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, requireStaff } from "@/lib/auth";
import { getAdminProduct, setOrderStatus, setUserRole, updateProductRow, updateShipping, type OrderStatus } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { orderStatus } from "@/db/schema";

const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;

export async function saveProductAction(fd: FormData) {
  const actor = await requireManager();
  const handle = String(fd.get("handle") ?? "");
  const priceSar = Number(fd.get("price"));
  const stock = Number(fd.get("stock"));
  const status = String(fd.get("status") ?? "");
  if (!handle || !Number.isFinite(priceSar) || priceSar < 0 || !Number.isInteger(stock) || stock < 0) {
    redirect(`/admin/products/${encodeURIComponent(handle)}?error=1`);
  }
  if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) redirect("/admin/products?error=1");

  // giá nhập bằng SAR, DB lưu SAR*100
  const before = await getAdminProduct(handle);
  await updateProductRow(handle, {
    priceMinor: Math.round(priceSar * 100),
    stock,
    status: status as (typeof PRODUCT_STATUSES)[number],
  });
  await writeAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.update",
    targetType: "product",
    targetId: handle,
    detail: before ? `price ${before.priceMinor / 100} -> ${priceSar} SAR, stock ${before.stock} -> ${stock}, status ${before.status} -> ${status}` : undefined,
  });
  revalidatePath("/admin/products");
  revalidatePath(`/product/${handle}`);
  redirect(`/admin/products/${encodeURIComponent(handle)}?saved=1`);
}

export async function saveOrderStatusAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!id || !(orderStatus.enumValues as readonly string[]).includes(status)) redirect("/admin/orders");
  await setOrderStatus(id, status as OrderStatus);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "order.status", targetType: "order", targetId: id, detail: `status -> ${status}` });
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${encodeURIComponent(id)}?saved=1`);
}

/** Vận chuyển (hoặc quản lí) cập nhật đơn vị vận chuyển + mã vận đơn + trạng thái giao. */
export async function saveShippingAction(fd: FormData) {
  const staff = await requireStaff();
  const id = String(fd.get("id") ?? "");
  const carrier = String(fd.get("carrier") ?? "").trim().slice(0, 80);
  const trackingCode = String(fd.get("trackingCode") ?? "").trim().slice(0, 80);
  const status = String(fd.get("status") ?? "");
  const allowed = ["processing", "shipped", "delivered"];
  if (!id || !allowed.includes(status)) redirect("/admin/orders?error=1");

  await updateShipping(id, { carrier: carrier || null, trackingCode: trackingCode || null, status: status as OrderStatus });
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

export async function saveUserRoleAction(fd: FormData) {
  const actor = await requireManager();
  const id = String(fd.get("id") ?? "");
  const role = String(fd.get("role") ?? "");
  const allowed = ["customer", "manager", "carrier"] as const;
  if (!id || !(allowed as readonly string[]).includes(role)) redirect("/admin/users?error=1");
  if (id === actor.id) redirect("/admin/users?error=self"); // không tự hạ quyền mình

  await setUserRole(id, role as (typeof allowed)[number]);
  await writeAudit({ actorId: actor.id, actorEmail: actor.email, action: "user.role", targetType: "user", targetId: id, detail: `role -> ${role}` });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}
