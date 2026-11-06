import type { ListFilters, Sort } from "./products";

export const SORTS: Sort[] = ["rating", "price_asc", "price_desc", "new", "title"];
export const GENDERS = ["Women", "Men", "Unisex"] as const;

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean);

export function parseFilters(sp: SearchParams): ListFilters {
  const gender = one(sp.gender);
  const size = many(sp.size).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const sort = one(sp.sort) as Sort | undefined;
  const page = Number(one(sp.page));
  const q = one(sp.q)?.trim();
  return {
    gender: GENDERS.includes(gender as (typeof GENDERS)[number]) ? gender : undefined,
    family: many(sp.family),
    accord: one(sp.accord) || undefined,
    size: size.length ? size : undefined,
    brand: one(sp.brand) || undefined,
    q: q && q.length <= 60 ? q : undefined,
    sort: sort && SORTS.includes(sort) ? sort : "rating",
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

export function shopHref(f: ListFilters, patch: Partial<ListFilters> = {}) {
  const next = { ...f, ...patch };
  const p = new URLSearchParams();
  if (next.gender) p.set("gender", next.gender);
  if (next.family?.length) p.set("family", next.family.join(","));
  if (next.accord) p.set("accord", next.accord);
  if (next.size?.length) p.set("size", next.size.join(","));
  if (next.brand) p.set("brand", next.brand);
  if (next.q) p.set("q", next.q);
  if (next.sort && next.sort !== "rating") p.set("sort", next.sort);
  if (next.page && next.page > 1) p.set("page", String(next.page));
  const qs = p.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

/** Bật/tắt một giá trị trong filter dạng mảng, luôn reset về trang 1. */
export function toggle<T>(list: T[] | undefined, value: T): T[] {
  const cur = list ?? [];
  return cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
}
