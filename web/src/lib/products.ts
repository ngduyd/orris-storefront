import { and, arrayContains, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { products } from "@/db/schema";

export type Product = typeof products.$inferSelect;
export type Sort = "rating" | "price_asc" | "price_desc" | "new" | "title";

export type ListFilters = {
  gender?: string;
  accord?: string;
  family?: string[];
  size?: number[];
  brand?: string;
  q?: string;
  sort?: Sort;
  page?: number;
  limit?: number;
};

export const PAGE_SIZE = 24;

const ORDER: Record<Sort, SQL> = {
  rating: sql`${products.ratingCount} desc nulls last`,
  price_asc: asc(products.priceMinor),
  price_desc: desc(products.priceMinor),
  new: sql`${products.year} desc nulls last`,
  title: asc(products.title),
};

/** `%` or `_` typed into search must not become a wildcard. */
const like = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

function where(f: ListFilters) {
  return and(
    eq(products.status, "active"),
    f.gender ? eq(products.gender, f.gender) : undefined,
    f.family?.length ? inArray(products.family, f.family) : undefined,
    f.accord ? arrayContains(products.accords, [f.accord]) : undefined,
    f.size?.length ? inArray(products.sizeMl, f.size) : undefined,
    f.brand ? ilike(products.brand, f.brand) : undefined,
    f.q ? or(ilike(products.title, `%${like(f.q)}%`), ilike(products.brand, `%${like(f.q)}%`)) : undefined,
  );
}

/**
 * Catalogue reads are cached in Next's data cache, keyed by their arguments: a bot walking
 * /shop?page=N or hitting the same filters costs one database query per unique URL per hour, not
 * one per request. Writes call revalidateTag("products").
 */
const CACHE = { revalidate: 3600, tags: ["products"] };

const cachedProduct = unstable_cache(async (handle: string) => {
  const [row] = await db.select().from(products).where(eq(products.handle, handle)).limit(1);
  return row ?? null;
}, ["product"], CACHE);

export async function getProduct(handle: string): Promise<Product | null> {
  return cachedProduct(handle);
}

export type ProductList = { items: Product[]; total: number; page: number; limit: number; pages: number };

const cachedListProducts = unstable_cache(async (f: ListFilters): Promise<ProductList> => {
  const limit = Math.min(f.limit ?? PAGE_SIZE, 60);
  const page = Math.max(f.page ?? 1, 1);
  const [items, [total]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where(f))
      .orderBy(ORDER[f.sort ?? "rating"])
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ n: sql<number>`count(*)::int` }).from(products).where(where(f)),
  ]);
  return { items, total: total.n, page, limit, pages: Math.max(1, Math.ceil(total.n / limit)) };
}, ["products:list"], CACHE);

export async function listProducts(f: ListFilters = {}): Promise<ProductList> {
  return cachedListProducts(f);
}

export type Facets = {
  byGender: { v: string; n: number }[];
  byFamily: { v: string | null; n: number }[];
  bySize: { v: number; n: number }[];
};

const cachedFacets = unstable_cache(async (gender?: string): Promise<Facets> => {
  const scope = and(eq(products.status, "active"), gender ? eq(products.gender, gender) : undefined);
  const [byGender, byFamily, bySize] = await Promise.all([
    db.select({ v: products.gender, n: sql<number>`count(*)::int` }).from(products).where(scope).groupBy(products.gender),
    db.select({ v: products.family, n: sql<number>`count(*)::int` }).from(products).where(scope).groupBy(products.family),
    db.select({ v: products.sizeMl, n: sql<number>`count(*)::int` }).from(products).where(scope).groupBy(products.sizeMl),
  ]);
  return { byGender, byFamily, bySize };
}, ["products:facets"], CACHE);

export async function getFacets(gender?: string): Promise<Facets> {
  return cachedFacets(gender);
}

export type BrandCount = { brand: string; n: number };

const cachedBrands = unstable_cache(async (limit: number): Promise<BrandCount[]> => {
  return db
    .select({ brand: products.brand, n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.status, "active"))
    .groupBy(products.brand)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}, ["products:brands"], CACHE);

export async function getBrands(limit = 60): Promise<BrandCount[]> {
  return cachedBrands(limit);
}

const cachedHandles = unstable_cache(
  async (): Promise<{ handle: string }[]> =>
    db.select({ handle: products.handle }).from(products).where(eq(products.status, "active")),
  ["products:handles"],
  CACHE,
);

export async function getHandles(): Promise<{ handle: string }[]> {
  return cachedHandles();
}
