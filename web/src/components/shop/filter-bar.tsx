import Link from "next/link";
import { parseFilters, shopHref, toggle, type SearchParams } from "@/lib/filters";
import { getFacets } from "@/lib/products";

const SIZE_ORDER = [30, 50, 75, 100, 125];
const SORTS: [string, string][] = [
  ["rating", "Most rated"],
  ["new", "Newest"],
  ["price_asc", "Price ↑"],
  ["price_desc", "Price ↓"],
];

export async function FilterBar({ sp }: { sp: SearchParams }) {
  const f = parseFilters(sp);
  const { byFamily, bySize } = await getFacets(f.gender);
  const families = byFamily
    .filter((x) => x.v && x.n >= 20)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const sizes = bySize.filter((x) => SIZE_ORDER.includes(x.v)).sort((a, b) => a.v - b.v);

  const active = [
    f.gender && `gender:${f.gender}`,
    ...(f.family ?? []),
    ...(f.size ?? []).map((s) => `${s}ml`),
    f.accord,
    f.brand,
    f.q,
  ].filter(Boolean) as string[];
  const sortLabel = SORTS.find(([k]) => k === (f.sort ?? "rating"))?.[1] ?? "Most rated";

  const groups = (
    <>
      <Group label="Family">
        {families.map((x) => (
          <Chip key={x.v} active={f.family?.includes(x.v!)} href={shopHref(f, { family: toggle(f.family, x.v!), page: 1 })}>
            {x.v}<span className="ml-2 text-[10px] tracking-normal text-taupe">{x.n}</span>
          </Chip>
        ))}
      </Group>
      <Group label="Size">
        {sizes.map((x) => (
          <Chip key={x.v} active={f.size?.includes(x.v)} href={shopHref(f, { size: toggle(f.size, x.v), page: 1 })}>
            {x.v}ml
          </Chip>
        ))}
      </Group>
      <Group label="Sort">
        {SORTS.map(([k, label]) => (
          <Chip key={k} active={(f.sort ?? "rating") === k} href={shopHref(f, { sort: k as never, page: 1 })}>
            {label}
          </Chip>
        ))}
      </Group>
      {active.length ? (
        <div className="pt-1">
          <Link href="/shop" className="label link-underline text-brass">Clear all</Link>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="border-y border-line">
      {/* mobile: collapsed, opened with <details> — no JS */}
      <details className="group md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
          <span className="label flex items-center gap-2 text-ink">
            Filter & sort
            <span aria-hidden className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-open:rotate-180">▾</span>
          </span>
          <span className="label">
            {active.length ? `${active.length} active` : sortLabel}
          </span>
        </summary>
        <div className="space-y-5 pb-5">{groups}</div>
      </details>

      <div className="hidden space-y-4 py-5 md:block">{groups}</div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label w-14 shrink-0">{label}</span>
      <div className="flex flex-1 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, href, children }: { active?: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex min-h-9 items-center border px-3 text-xs transition-colors duration-300 ease-[var(--ease-out-soft)] ${
        active ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-taupe"
      }`}
    >
      {children}
    </Link>
  );
}

export function Pagination({ f, pages }: { f: ReturnType<typeof parseFilters>; pages: number }) {
  const page = f.page ?? 1;
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 2,
  );
  return (
    <nav className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Chip href={shopHref(f, { page: page - 1 })}>Prev</Chip>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-xs text-taupe">…</span>}
          <Chip active={n === page} href={shopHref(f, { page: n })}>{n}</Chip>
        </span>
      ))}
      {page < pages && <Chip href={shopHref(f, { page: page + 1 })}>Next</Chip>}
    </nav>
  );
}
