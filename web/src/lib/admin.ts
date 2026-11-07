import { and, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, reviews, users, type orderStatus } from "@/db/schema";

export const ADMIN_PAGE_SIZE = 20;

export type OrderStatus = (typeof orderStatus.enumValues)[number];

export async function stats() {
  const [p] = await db
    .select({
      active: sql<number>`count(*) filter (where status = 'active')::int`,
      draft: sql<number>`count(*) filter (where status = 'draft')::int`,
      archived: sql<number>`count(*) filter (where status = 'archived')::int`,
      lowStock: sql<number>`count(*) filter (where stock < 5)::int`,
    })
    .from(products);

  const byStatus = await db
    .select({ status: orders.status, n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(total_minor), 0)::int` })
    .from(orders)
    .groupBy(orders.status);

  return { products: p, orders: byStatus };
}

export async function recentOrders(limit = 8) {
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function listOrders({ status, page, q }: { status?: OrderStatus; page: number; q?: string }) {
  const term = (q ?? "").trim().slice(0, 60);
  const search = term
    ? or(
        ilike(orders.email, `%${term}%`),
        ilike(orders.customerName, `%${term}%`),
        like(orders.id, `${term}%`),
      )
    : undefined;
  const where = and(status ? eq(orders.status, status) : undefined, search);
  const [items, [c]] = await Promise.all([
    db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(ADMIN_PAGE_SIZE).offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);
  return { items, total: c.n, pages: Math.max(1, Math.ceil(c.n / ADMIN_PAGE_SIZE)) };
}

export async function getOrderDetail(id: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { order, items };
}

export async function setOrderStatus(id: string, status: OrderStatus) {
  const paid = ["paid", "processing", "shipped", "delivered"].includes(status);
  await db.update(orders).set({ status, paid }).where(eq(orders.id, id));
}

/** Carrier fields move only while the order is paid and alive; returns false when the guard refused. */
/** Forward-only shipping ranks. `paid` counts as rank 0 (ready to ship). */
const SHIPPING_RANK: Record<string, number> = { paid: 0, processing: 1, shipped: 2, delivered: 3 };

/**
 * Moves a shipment forward only. A tracking-code edit keeps the status (no email); moving
 * backwards is refused, so a carrier cannot re-trigger notices by looping shipped -> processing.
 * Returns the previous status, or null when the update was rejected.
 */
export async function updateShipping(
  id: string,
  { carrier, trackingCode, status }: { carrier: string | null; trackingCode: string | null; status: OrderStatus },
) {
  const targetRank = SHIPPING_RANK[status];
  if (targetRank === undefined) return null;

  const [before] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!before) return null;

  const currentRank = SHIPPING_RANK[before.status];
  if (currentRank === undefined || targetRank < currentRank) return null;

  // optimistic guard: only applies if nobody moved the order in between
  const rows = await db
    .update(orders)
    .set({ carrier, trackingCode, status })
    .where(and(eq(orders.id, id), eq(orders.status, before.status)))
    .returning({ id: orders.id });

  return rows.length ? before.status : null;
}

export async function listAdminProducts({
  q,
  status,
  page,
  lowStock,
}: {
  q?: string;
  status?: "draft" | "active" | "archived";
  page: number;
  lowStock?: boolean;
}) {
  const where = and(
    status ? eq(products.status, status) : undefined,
    lowStock ? sql`${products.stock} <= 3` : undefined,
    q ? or(ilike(products.title, `%${q}%`), ilike(products.brand, `%${q}%`), ilike(products.handle, `%${q}%`)) : undefined,
  );
  const [items, [c]] = await Promise.all([
    db
      .select({ handle: products.handle, title: products.title, brand: products.brand, sizeMl: products.sizeMl, priceMinor: products.priceMinor, status: products.status, stock: products.stock, image: products.image, images: products.images })
      .from(products)
      .where(where)
      .orderBy(products.brand, products.title)
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(products).where(where),
  ]);
  return { items, total: c.n, pages: Math.max(1, Math.ceil(c.n / ADMIN_PAGE_SIZE)) };
}

export async function getAdminProduct(handle: string) {
  const [row] = await db.select().from(products).where(eq(products.handle, handle)).limit(1);
  return row ?? null;
}

export async function updateProductRow(
  handle: string,
  patch: {
    title: string;
    brand: string;
    sizeMl: number;
    priceMinor: number;
    compareAtMinor: number | null;
    stock: number;
    status: "draft" | "active" | "archived";
    image: string;
    images: string[];
    description: string | null;
  },
) {
  await db.update(products).set({ ...patch, updatedAt: new Date() }).where(eq(products.handle, handle));
}

export async function listUsers({ q, role, page }: { q?: string; role?: string; page: number }) {
  const where = and(
    role ? eq(users.role, role) : undefined,
    q ? ilike(users.email, `%${q}%`) : undefined,
  );

  // join thay vì subquery: trong subquery, `email` bị Postgres hiểu là orders.email
  const base = db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      name: users.name,
      provider: users.provider,
      verified: users.emailVerifiedAt,
      createdAt: users.createdAt,
      orders: sql<number>`count(distinct ${orders.id})::int`,
      spent: sql<number>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.paid}), 0)::int`,
    })
    .from(users)
    .leftJoin(orders, or(eq(orders.userId, users.id), eq(orders.email, users.email)))
    .where(where)
    .groupBy(users.id)
    .orderBy(desc(users.createdAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  const [items, [c]] = await Promise.all([
    base,
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { items, total: c.n, pages: Math.max(1, Math.ceil(c.n / ADMIN_PAGE_SIZE)) };
}

export async function setUserRole(id: string, role: "customer" | "manager" | "carrier") {
  await db.update(users).set({ role }).where(eq(users.id, id));
}

/** Sales: paid orders only. */
export async function salesStats() {
  const [totals] = await db
    .select({
      revenue: sql<number>`coalesce(sum(total_minor) filter (where paid), 0)::int`,
      paidOrders: sql<number>`count(*) filter (where paid)::int`,
      openOrders: sql<number>`count(*) filter (where not paid and status not in ('cancelled','refunded'))::int`,
      avgOrder: sql<number>`coalesce(avg(total_minor) filter (where paid), 0)::int`,
    })
    .from(orders);

  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', created_at), 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(total_minor) filter (where paid), 0)::int`,
      orders: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(sql`created_at > now() - interval '14 days'`)
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`);

  const topBrands = await db
    .select({
      brand: products.brand,
      units: sql<number>`sum(${orderItems.qty})::int`,
      revenue: sql<number>`sum(${orderItems.qty} * ${orderItems.priceMinor})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.handle, orderItems.handle))
    .where(eq(orders.paid, true))
    .groupBy(products.brand)
    .orderBy(sql`sum(${orderItems.qty} * ${orderItems.priceMinor}) desc`)
    .limit(8);

  return { totals, daily, topBrands };
}

export async function listBrands() {
  return db
    .select({
      brand: products.brand,
      products: sql<number>`count(*)::int`,
      onSale: sql<number>`count(*) filter (where compare_at_minor > price_minor)::int`,
    })
    .from(products)
    .groupBy(products.brand)
    .orderBy(products.brand);
}

export async function brandExists(name: string) {
  const [row] = await db.select({ brand: products.brand }).from(products).where(eq(products.brand, name)).limit(1);
  return Boolean(row);
}

/** Rename a brand across every product (merges when the new name already exists). */
export async function renameBrand(from: string, to: string) {
  const rows = await db.update(products).set({ brand: to, updatedAt: new Date() }).where(eq(products.brand, from)).returning({ handle: products.handle });
  return rows.length;
}

/** Newest reviews for the moderation queue, hidden ones included. */
export async function listReviewsForAdmin(limit = 50) {
  return db
    .select({
      id: reviews.id,
      handle: reviews.handle,
      title: products.title,
      brand: products.brand,
      rating: reviews.rating,
      body: reviews.body,
      authorName: reviews.authorName,
      email: users.email,
      hidden: reviews.hidden,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .leftJoin(products, eq(products.handle, reviews.handle))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

/** Returns the review's product handle, or null when the id does not exist. */
export async function setReviewHidden(id: string, hidden: boolean) {
  const [row] = await db.update(reviews).set({ hidden }).where(eq(reviews.id, id)).returning({ handle: reviews.handle });
  return row?.handle ?? null;
}

/** True when another product still points at this image, so removing it must not delete the file. */
export async function imageUsedElsewhere(value: string, exceptHandle: string) {
  const rows = await db.execute(sql`select 1 from products where handle <> ${exceptHandle} and ${value} = any(images) limit 1`);
  return rows.rows.length > 0;
}

export async function getUserDetail(id: string) {
  const [user] = await db.select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, id)).limit(1);
  if (!user) return null;
  const list = await db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)).limit(50);
  const paid = list.filter((o) => o.paid);
  return { user, orders: list, spendMinor: paid.reduce((s, o) => s + o.totalMinor, 0), paidCount: paid.length };
}
