import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addToCartAction } from "@/actions/cart";
import { toggleWishlistAction } from "@/actions/wishlist";
import { NotePyramid } from "@/components/shop/note-pyramid";
import { ReviewFlash } from "@/components/shop/review-flash";
import { ProductGallery } from "@/components/shop/product-gallery";
import { deleteReviewAction, submitReviewAction } from "@/actions/reviews";
import { listReviews, myReview, purchaseOrderId, reviewStats } from "@/lib/reviews";
import { getProduct } from "@/lib/products";
import { currentUser } from "@/lib/auth";
import { isWished } from "@/lib/wishlist";
import { SAR_PER_USD, discountPercent, onSale, sarNote, usd } from "@/lib/money";
import { imageUrl } from "@/lib/image";

// prerendering 3,051 pages hung the build for >15 minutes; ISR gives the same output quickly
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
  const [stats, reviewList, mine, bought] = await Promise.all([
    reviewStats(p.handle),
    listReviews(p.handle),
    viewer ? myReview(p.handle, viewer.id) : null,
    viewer ? purchaseOrderId(p.handle, viewer) : Promise.resolve(null),
  ]);

  // each spec links to its matching filter page
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

  // structured data for search engines; aggregateRating only when real reviews exist
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${p.title} · ${p.brand}`,
    brand: { "@type": "Brand", name: p.brand },
    image: imageUrl(p.image, 1200),
    description: (p.description ?? `${p.title} by ${p.brand}, ${p.sizeMl}ml.`).slice(0, 300),
    offers: {
      "@type": "Offer",
      price: (p.priceMinor / SAR_PER_USD / 100).toFixed(2),
      priceCurrency: "USD",
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(stats.count > 0 && stats.avg !== null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stats.avg.toFixed(1), reviewCount: stats.count } } : {}),
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
      <nav className="label flex gap-2">
        <Link href="/shop" className="link-underline hover:text-ink">Collection</Link>
        <span>/</span>
        <Link href={`/shop?brand=${encodeURIComponent(p.brand)}`} className="link-underline hover:text-ink">{p.brand}</Link>
      </nav>

      <div className="mt-8 grid gap-12 md:grid-cols-2 md:gap-16">
        <div className="md:sticky md:top-28 md:self-start">
          <ProductGallery
            alt={`${p.brand} ${p.title}`}
            images={(p.images.length ? p.images : [p.image]).map((name) => ({ name, url: imageUrl(name, 1200) }))}
          />
        </div>

        <div>
          <p className="label">{p.brand}</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight font-light sm:text-5xl">{p.title}</h1>

          <div className="mt-5 flex flex-wrap items-baseline gap-4">
            <span className={`text-lg ${onSale(p) ? "text-brass" : ""}`} title={sarNote(p.priceMinor)}>{usd(p.priceMinor)}</span>
            {onSale(p) ? (
              <>
                <span className="text-sm text-taupe line-through">{usd(p.compareAtMinor!)}</span>
                <span className="bg-brass px-2 py-1 text-[0.6rem] uppercase tracking-[0.14em] text-ivory">−{discountPercent(p)}%</span>
              </>
            ) : null}
            <span className="text-sm text-taupe">
              {p.sizeMl} ml{p.concentration ? ` · ${p.concentration}` : ""}
              {p.family ? ` · ${p.family}` : ""}
            </span>
          </div>

          {stats.count ? (
            <p className="mt-2 text-sm text-taupe">
              <span className="text-ink">{stats.avg?.toFixed(1)} / 5</span> · {stats.count} review{stats.count === 1 ? "" : "s"}
              {p.ratingCount ? <span className="ml-1">(catalog: {p.ratingCount})</span> : null}
            </p>
          ) : p.rating !== null && p.ratingCount ? (
            <p className="mt-2 text-sm text-taupe">
              {Number(p.rating).toFixed(1)} / 5 · {p.ratingCount} ratings from the source catalog — no store reviews yet
            </p>
          ) : (
            <p className="mt-2 text-sm text-taupe">No reviews yet</p>
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

          <section id="reviews" className="mt-10 border-t border-line pt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="label">Reviews{stats.count ? ` · ${stats.count}` : ""}</h2>
              {reviewList.length ? <p className="label">latest {reviewList.length}</p> : null}
            </div>

            {reviewList.length ? (
              <ul className="mt-4 divide-y divide-line/60">
                {reviewList.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-sm text-ink">
                        <span className="text-brass">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></span>
                        <span className="ml-2 text-taupe">{r.authorName ?? r.name ?? "Verified buyer"}</span>
                        <span className="ml-2 border border-line px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.12em] text-taupe">
                          verified · #{r.orderId.slice(0, 8)}
                        </span>
                      </p>
                      <p className="label shrink-0">{r.createdAt.toISOString().slice(0, 10)}</p>
                    </div>
                    {r.body ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.body}</p> : null}
                    {viewer?.id === r.userId ? (
                      <form action={deleteReviewAction} className="mt-2">
                        <input type="hidden" name="handle" value={p.handle} />
                        <button className="label min-h-6 text-taupe hover:text-ink">Delete my review</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-taupe">No store reviews yet.</p>
            )}

            <Suspense fallback={null}>
              <ReviewFlash />
            </Suspense>

            {bought || mine ? (
            <form action={submitReviewAction} className="mt-6 border border-line p-4">
              <input type="hidden" name="handle" value={p.handle} />
              <p className="label">{mine ? "Edit your review" : "Write a review"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="label flex items-center gap-2">
                  Rating
                  <select name="rating" defaultValue={String(mine?.rating ?? 5)} className="border border-line bg-transparent px-2 py-1.5 text-sm focus:border-ink focus:outline-none">
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                  </select>
                </label>
                <input
                  name="authorName"
                  defaultValue={mine?.authorName ?? viewer?.email.split("@")[0] ?? ""}
                  placeholder="Display name"
                  className="w-40 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none"
                />
                <textarea name="body" rows={3} defaultValue={mine?.body ?? ""} placeholder="How does it wear? Anything worth knowing?" className="min-w-56 flex-1 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button className="border border-ink px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
                  {mine ? "Update review" : "Post review"}
                </button>
                <span className="text-xs text-taupe">Attached to your paid order #{bought?.slice(0, 8)}. Posting again edits it.</span>
              </div>
            </form>
            ) : (
              <p className="mt-6 border border-line bg-ivory-deep p-4 text-sm text-ink-soft">
                {viewer ? (
                  <>Reviews are open to verified buyers only. Order this bottle and the form appears here.</>
                ) : (
                  <>
                    <Link href={`/account/login?next=${encodeURIComponent(`/product/${p.handle}`)}`} className="link-underline text-brass">Sign in</Link>{" "}
                    to review this bottle — reviews are open to verified buyers only.
                  </>
                )}
              </p>
            )}
          </section>

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
