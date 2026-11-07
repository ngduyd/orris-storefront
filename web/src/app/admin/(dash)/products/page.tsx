import Image from "next/image";
import Link from "next/link";
import { listAdminProducts } from "@/lib/admin";
import { requireManager } from "@/lib/auth";
import { imageUrl } from "@/lib/image";
import { usd } from "@/lib/money";

const STATUSES = ["draft", "active", "archived"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requireManager();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, pages } = await listAdminProducts({ q, status, page });

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, status, page: String(page), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/products?${p}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">Products</h1>
        <p className="label">{total.toLocaleString("en-US")} · page {page}</p>
      </div>

      <form className="mt-6 flex flex-wrap gap-2" action="/admin/products">
        <input name="q" defaultValue={q} placeholder="Brand, title, handle" className="min-w-56 flex-1 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none" />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button className="border border-ink px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={qs({ status: undefined, page: "1" })} className={`border px-3 py-1.5 text-xs ${!status ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"}`}>all</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={qs({ status: s, page: "1" })} className={`border px-3 py-1.5 text-xs ${status === s ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"}`}>{s}</Link>
        ))}
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 font-normal" />
            <th className="label py-2 font-normal">Product</th>
            <th className="label py-2 font-normal">Status</th>
            <th className="label py-2 text-right font-normal">Stock</th>
            <th className="label py-2 text-right font-normal">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.handle} className="border-b border-line/60">
              <td className="w-12 py-2">
                <div className="relative size-10 bg-ivory-deep">
                  <Image src={imageUrl(p.images[0] || p.image, 80)} alt="" fill sizes="40px" className="object-contain p-1" />
                </div>
              </td>
              <td className="py-2">
                <Link href={`/admin/products/${p.handle}`} className="link-underline">{p.brand} · {p.title}</Link>
                <span className="block text-xs text-taupe">{p.sizeMl} ml</span>
              </td>
              <td className={`py-2 ${p.status === "active" ? "text-ink-soft" : "text-brass"}`}>{p.status}</td>
              <td className={`py-2 text-right ${p.stock < 5 ? "text-brass" : "text-ink-soft"}`}>{p.stock}</td>
              <td className="py-2 text-right">{usd(p.priceMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!items.length ? <p className="mt-6 text-sm text-taupe">No match.</p> : null}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-between">
          <Link href={qs({ page: String(page - 1) })} aria-disabled={page <= 1} className={`label ${page <= 1 ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>← Prev</Link>
          <span className="label">{page} / {pages}</span>
          <Link href={qs({ page: String(page + 1) })} aria-disabled={page >= pages} className={`label ${page >= pages ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>Next →</Link>
        </nav>
      ) : null}
    </div>
  );
}
