import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, users, type orderStatus } from "@/db/schema";

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

export async function listOrders({ status, page }: { status?: OrderStatus; page: number }) {
  const where = status ? eq(orders.status, status) : undefined;
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

export async function updateShipping(
  id: string,
  { carrier, trackingCode, status }: { carrier: string | null; trackingCode: string | null; status: OrderStatus },
) {
  await db.update(orders).set({ carrier, trackingCode, status }).where(eq(orders.id, id));
}

export async function listAdminProducts({ q, status, page }: { q?: string; status?: "draft" | "active" | "archived"; page: number }) {
  const where = and(
    status ? eq(products.status, status) : undefined,
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
