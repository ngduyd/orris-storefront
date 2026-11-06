import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveProductAction } from "@/actions/admin";
import { getAdminProduct } from "@/lib/admin";
import { requireManager } from "@/lib/auth";
import { imageUrl } from "@/lib/image";
import { sarNote, usd } from "@/lib/money";

export default async function AdminProductEdit({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireManager();
  const { handle } = await params;
  const { saved, error } = await searchParams;
  const p = await getAdminProduct(handle);
  if (!p) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/admin/products" className="label link-underline hover:text-ink">← Products</Link>

      <div className="mt-4 flex gap-6">
        <div className="relative size-28 shrink-0 bg-ivory-deep">
          <Image src={imageUrl(p.image, 240)} alt="" fill sizes="112px" className="object-contain p-2" />
        </div>
        <div>
          <p className="label">{p.brand}</p>
          <h1 className="mt-2 font-serif text-3xl font-light">{p.title}</h1>
          <p className="mt-2 text-sm text-taupe">
            {p.sizeMl} ml{p.concentration ? ` · ${p.concentration}` : ""} · {p.gender}
            {p.family ? ` · ${p.family}` : ""}
          </p>
          <Link href={`/product/${p.handle}`} className="label link-underline mt-3 inline-block hover:text-ink">View on storefront</Link>
        </div>
      </div>

      {saved ? <p className="mt-6 text-sm text-brass">Saved.</p> : null}
      {error ? <p className="mt-6 text-sm text-brass">Kiểm tra lại giá và tồn kho (số không âm).</p> : null}

      <form action={saveProductAction} className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-3">
        <input type="hidden" name="handle" value={p.handle} />

        <label className="block">
          <span className="label">Price (SAR)</span>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={(p.priceMinor / 100).toFixed(2)}
            className="mt-2 w-full border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none"
          />
          <span className="mt-1 block text-xs text-taupe">{usd(p.priceMinor)} · db {sarNote(p.priceMinor)}</span>
        </label>

        <label className="block">
          <span className="label">Stock</span>
          <input
            name="stock"
            type="number"
            step="1"
            min="0"
            required
            defaultValue={p.stock}
            className="mt-2 w-full border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="label">Status</span>
          <select name="status" defaultValue={p.status} className="mt-2 w-full border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none">
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </label>

        <div className="sm:col-span-3">
          <button className="border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">
            Save changes
          </button>
        </div>
      </form>

      <dl className="mt-10 grid gap-2 border-t border-line pt-6 text-xs text-taupe">
        <div className="flex justify-between"><dt>handle</dt><dd className="font-mono">{p.handle}</dd></div>
        <div className="flex justify-between"><dt>rating</dt><dd>{p.rating ?? "—"} ({p.ratingCount ?? 0})</dd></div>
        <div className="flex justify-between"><dt>year</dt><dd>{p.year ?? "—"}</dd></div>
        <div className="flex justify-between"><dt>updated</dt><dd>{p.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</dd></div>
      </dl>
    </div>
  );
}
