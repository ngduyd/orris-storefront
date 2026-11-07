import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { endSaleAction, saveProductAction } from "@/actions/admin";
import { getAdminProduct, listBrands } from "@/lib/admin";
import { requireManager } from "@/lib/auth";
import { imageUrl } from "@/lib/image";
import { discountPercent, onSale, sarNote, usd } from "@/lib/money";

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
  const brands = await listBrands();
  if (!p) notFound();

  const field = "mt-2 w-full border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none";

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
          <p className="mt-1 text-sm text-ink-soft">
            {usd(p.priceMinor)}{" "}
            {onSale(p) ? (
              <span className="text-taupe">· was {usd(p.compareAtMinor!)} (−{discountPercent(p)}%)</span>
            ) : (
              <span className="text-taupe">· no sale</span>
            )}
          </p>
          <Link href={`/product/${p.handle}`} className="label link-underline mt-3 inline-block hover:text-ink">View on storefront</Link>
        </div>
      </div>

      {saved ? <p className="mt-6 text-sm text-brass">Saved.</p> : null}
      {error === "brand" ? (
        <p className="mt-6 text-sm text-brass">
          Brand này chưa có trong catalog. Tick “create new brand” nếu thật sự muốn tạo.
        </p>
      ) : error ? (
        <p className="mt-6 text-sm text-brass">Check the fields: price/stock/size non-negative, title/brand/image required, compare-at only counts when above price.</p>
      ) : null}

      <form action={saveProductAction} className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
        <input type="hidden" name="handle" value={p.handle} />

        <label className="block sm:col-span-2">
          <span className="label">Title</span>
          <input name="title" required defaultValue={p.title} className={field} />
        </label>

        <label className="block">
          <span className="label">Brand</span>
          <input name="brand" required defaultValue={p.brand} list="brand-list" autoComplete="off" className={field} />
          <datalist id="brand-list">
            {brands.map((b) => (
              <option key={b.brand} value={b.brand}>{b.products}</option>
            ))}
          </datalist>
          <label className="mt-2 flex items-center gap-2 text-xs text-taupe">
            <input type="checkbox" name="newBrand" className="size-3 accent-ink" />
            create new brand
          </label>
        </label>

        <label className="block">
          <span className="label">Size (ml)</span>
          <input name="sizeMl" type="number" step="1" min="1" required defaultValue={p.sizeMl} className={field} />
        </label>

        <label className="block">
          <span className="label">Sale price (SAR)</span>
          <input name="price" type="number" step="0.01" min="0" required defaultValue={(p.priceMinor / 100).toFixed(2)} className={field} />
          <span className="mt-1 block text-xs text-taupe">{usd(p.priceMinor)} · db {sarNote(p.priceMinor)}</span>
        </label>

        <label className="block">
          <span className="label">Regular price before sale (SAR, optional)</span>
          <input
            name="compareAt"
            type="number"
            step="0.01"
            min="0"
            defaultValue={p.compareAtMinor === null ? "" : (p.compareAtMinor / 100).toFixed(2)}
            placeholder="bỏ trống = không sale"
            className={field}
          />
          <span className="mt-1 block text-xs text-taupe">Điền giá gốc lớn hơn giá sale để bật sale; bỏ trống = giá thường.</span>
        </label>

        <label className="block">
          <span className="label">Stock</span>
          <input name="stock" type="number" step="1" min="0" required defaultValue={p.stock} className={field} />
        </label>

        <label className="block">
          <span className="label">Status</span>
          <select name="status" defaultValue={p.status} className={field}>
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="label">Image (file name in Cloudinary, public_id = bỏ phần mở rộng)</span>
          <input name="image" required defaultValue={p.image} className={field} />
          <span className="mt-1 block text-xs text-taupe">Tên file phải tồn tại trên Cloudinary (public_id = tên không đuôi).</span>
        </label>

        <label className="block sm:col-span-2">
          <span className="label">Description</span>
          <textarea name="description" rows={6} defaultValue={p.description ?? ""} className={field} />
        </label>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button className="border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">
            Save changes
          </button>
        </div>
      </form>

      {onSale(p) ? (
        <form action={endSaleAction} className="mt-4">
          <input type="hidden" name="handle" value={p.handle} />
          <button className="border border-line px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft transition-colors duration-300 ease-[var(--ease-out-soft)] hover:border-ink hover:text-ink">
            End sale · keep {usd(p.compareAtMinor!)} as the price
          </button>
        </form>
      ) : null}

      <dl className="mt-10 grid gap-2 border-t border-line pt-6 text-xs text-taupe">
        <div className="flex justify-between"><dt>handle</dt><dd className="font-mono">{p.handle}</dd></div>
        <div className="flex justify-between"><dt>concentration / family / gender</dt><dd>{p.concentration ?? "—"} / {p.family ?? "—"} / {p.gender}</dd></div>
        <div className="flex justify-between"><dt>rating (nguồn catalog)</dt><dd>{p.rating ?? "—"} ({p.ratingCount ?? 0})</dd></div>
        <div className="flex justify-between"><dt>year</dt><dd>{p.year ?? "—"}</dd></div>
        <div className="flex justify-between"><dt>updated</dt><dd>{p.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</dd></div>
      </dl>
    </div>
  );
}
