import Link from "next/link";
import { listBrands } from "@/lib/admin";
import { renameBrandAction } from "@/actions/admin";
import { requireManager } from "@/lib/auth";

export default async function AdminBrands({ searchParams }: { searchParams: Promise<{ q?: string; saved?: string; error?: string }> }) {
  await requireManager();
  const sp = await searchParams;
  const q = sp.q?.trim().toLowerCase() ?? "";
  const all = await listBrands();
  const brands = q ? all.filter((b) => b.brand.toLowerCase().includes(q)) : all;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">Brands</h1>
        <p className="label">{all.length} houses · {all.reduce((s, b) => s + b.products, 0).toLocaleString("en-US")} products</p>
      </div>

      {sp.saved ? <p className="mt-4 text-sm text-brass">Renamed.</p> : null}
      {sp.error ? <p className="mt-4 text-sm text-brass">Both the current and the new name are required.</p> : null}

      <form className="mt-6 flex flex-wrap gap-2" action="/admin/brands">
        <input name="q" defaultValue={sp.q} placeholder="Search house" className="min-w-56 flex-1 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none" />
        <button className="border border-ink px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">Search</button>
      </form>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 pr-6 font-normal">House</th>
            <th className="label py-2 pr-6 text-right font-normal">Products</th>
            <th className="label py-2 pr-8 text-right font-normal">On sale</th>
            <th className="label w-72 py-2 pl-6 font-normal">Rename to</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((b) => (
            <tr key={b.brand} className="border-b border-line/60">
              <td className="py-2 pr-6">
                <Link href={`/admin/products?q=${encodeURIComponent(b.brand)}`} className="link-underline">{b.brand}</Link>
              </td>
              <td className="py-2 pr-6 text-right tabular-nums text-taupe">{b.products}</td>
              <td className="py-2 pr-8 text-right tabular-nums text-taupe">{b.onSale || "—"}</td>
              <td className="py-2 pl-6">
                <form action={renameBrandAction} className="flex items-center gap-3">
                  <input type="hidden" name="from" value={b.brand} />
                  <input name="to" defaultValue={b.brand} className="w-56 border border-line bg-transparent px-2 py-1.5 text-xs focus:border-ink focus:outline-none" />
                  <button className="label min-h-6 text-brass hover:text-ink">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!brands.length ? <p className="mt-6 text-sm text-taupe">No house matches “{sp.q}”.</p> : null}

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-taupe">
        Renaming updates every product of that house. If the new name already exists the two houses merge — that is
        intentional, use it to fix typos. Brand is still plain text on the product row; a dedicated{" "}
        <span className="font-mono">brands</span> table only becomes worth it once houses need their own page, logo or SEO.
      </p>
    </div>
  );
}
