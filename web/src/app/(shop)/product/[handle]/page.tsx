import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addToCartAction } from "@/actions/cart";
import { toggleWishlistAction } from "@/actions/wishlist";
import { NotePyramid } from "@/components/shop/note-pyramid";
import { getProduct } from "@/lib/products";
import { currentUser } from "@/lib/auth";
import { isWished } from "@/lib/wishlist";
import { sarNote, usd } from "@/lib/money";
import { imageUrl } from "@/lib/image";

// 3,051 trang SSG làm build treo >15 phút; ISR cho cùng kết quả với build nhanh
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps<"/product/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const p = await getProduct(handle);
  if (!p) return { title: "Not found" };
  return {
    title: `${p.title} · ${p.brand}`,
    description: (p.description ?? `${p.title} by ${p.brand}, ${p.sizeMl}ml.`).slice(0, 160),
    openGraph: { images: [imageUrl(p.image, 1200)] },
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[handle]">) {
  const { handle } = await params;
  const p = await getProduct(handle);
  if (!p) notFound();

  const viewer = await currentUser();
  const wished = await isWished(viewer?.id, p.handle);

  // mỗi thông số trỏ về trang lọc tương ứng
  const specLink = (k: string, v: string) => {
    const href =
      k === "House" ? `/shop?brand=${encodeURIComponent(v)}`
      : k === "Family" ? `/shop?family=${encodeURIComponent(v)}`
      : k === "Gender" ? `/shop?gender=${v}`
      : null;
    return href ? (
      <Link href={href} className="link-underline hover:text-ink">{v}</Link>
    ) : (
      v
    );
  };

  const specs = [
    ["House", p.brand],
    ["Family", p.family],
    ["Concentration", p.concentration],
    ["Size", `${p.sizeMl} ml`],
    ["Gender", p.gender],
    ["Year", p.year ? String(p.year) : null],
  ].filter((s): s is [string, string] => Boolean(s[1]));

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <nav className="label flex gap-2">
        <Link href="/shop" className="link-underline hover:text-ink">Collection</Link>
        <span>/</span>
        <Link href={`/shop?brand=${encodeURIComponent(p.brand)}`} className="link-underline hover:text-ink">{p.brand}</Link>
      </nav>

      <div className="mt-8 grid gap-12 md:grid-cols-2 md:gap-16">
        <div className="md:sticky md:top-28 md:self-start">
          <div className="relative aspect-4/5 bg-ivory-deep">
            <Image
              src={imageUrl(p.image, 1200)}
              alt={`${p.brand} ${p.title}`}
              fill
              sizes="(min-width:768px) 50vw, 100vw"
              priority
              className="fade-in object-contain p-10"
            />
          </div>
        </div>

        <div>
          <p className="label">{p.brand}</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight font-light sm:text-5xl">{p.title}</h1>

          <div className="mt-5 flex flex-wrap items-baseline gap-4">
            <span className="text-lg" title={sarNote(p.priceMinor)}>{usd(p.priceMinor)}</span>
            <span className="text-sm text-taupe">
              {p.sizeMl} ml{p.concentration ? ` · ${p.concentration}` : ""}
              {p.family ? ` · ${p.family}` : ""}
            </span>
          </div>

          {p.rating !== null && p.ratingCount ? (
            <p className="mt-2 text-sm text-taupe">
              {Number(p.rating).toFixed(1)} / 5 · {p.ratingCount} ratings
            </p>
          ) : (
            <p className="mt-2 text-sm text-taupe">Not yet rated</p>
          )}

          <form action={addToCartAction} className="mt-8 flex gap-3">
            <input type="hidden" name="handle" value={p.handle} />
            <button
              className="flex-1 border border-ink px-8 py-3.5 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory"
              disabled={p.stock <= 0}
            >
              {p.stock > 0 ? "Add to bag" : "Sold out"}
            </button>
          </form>

          <form action={toggleWishlistAction} className="mt-3">
            <input type="hidden" name="handle" value={p.handle} />
            <input type="hidden" name="back" value={`/product/${p.handle}`} />
            <button className={`w-full border px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] ${wished ? "border-brass text-brass" : "border-line text-ink-soft hover:border-ink"}`}>
              {wished ? "♥ Saved to wishlist" : "♡ Save to wishlist"}
            </button>
          </form>

          <div className="mt-10">
            <p className="label mb-3">Notes</p>
            <NotePyramid notes={p.notes} />
          </div>

          {p.accords.length ? (
            <div className="mt-8">
              <p className="label mb-3">Accords</p>
              <ul className="flex flex-wrap gap-2">
                {p.accords.map((a) => (
                  <li key={a}>
                    <Link
                      href={`/shop?accord=${encodeURIComponent(a)}`}
                      className="block border border-line px-3 py-1 text-xs text-ink-soft transition-colors duration-300 ease-[var(--ease-out-soft)] hover:border-ink hover:bg-ink hover:text-ivory"
                    >
                      {a}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {p.description ? (
            <details className="group mt-8">
              <summary className="label flex cursor-pointer list-none items-center gap-2 marker:content-none">
                The house says<span className="text-taupe transition-transform duration-300 ease-[var(--ease-out-soft)] group-open:rotate-90">›</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{p.description}</p>
            </details>
          ) : null}

          <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-line pt-6 text-sm sm:grid-cols-2">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="label pt-0.5">{k}</dt>
                <dd className="text-right text-ink-soft">{specLink(k, v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
