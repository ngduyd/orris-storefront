import type { Metadata } from "next";
import { FilterBar, Pagination } from "@/components/shop/filter-bar";
import { ProductGrid } from "@/components/shop/product-card";
import { parseFilters, shopHref, type SearchParams } from "@/lib/filters";
import { listProducts } from "@/lib/products";
import { currentUser } from "@/lib/auth";
import { wishedIn } from "@/lib/wishlist";

export const metadata: Metadata = { title: "The collection" };

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const { items, total, pages } = await listProducts(f);
  const viewer = await currentUser();
  const wished = await wishedIn(viewer?.id, items.map((i) => i.handle));
  const back = `/shop${Object.keys(sp).length ? `?${new URLSearchParams(sp as Record<string, string>)}` : ""}`;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">The collection</p>
          <h1 className="mt-2 font-serif text-3xl font-light sm:text-5xl">
            {f.accord ?? f.gender ?? "Everything"}
            {f.q ? <span className="text-taupe"> · “{f.q}”</span> : null}
          </h1>
        </div>
        <p className="label">
          {total.toLocaleString("en-US")} bottles · page {f.page}
        </p>
      </div>

      <div className="mt-8">
        <FilterBar sp={sp} />
      </div>

      {items.length ? (
        <div className="mt-10">
          <ProductGrid items={items} wished={wished} back={back} />
        </div>
      ) : (
        <div className="py-24 text-center text-sm text-taupe">
          {total > 0 ? (
            <>
              <p>This page is past the end of the collection.</p>
              <a href={shopHref(f, { page: 1 })} className="label mt-4 inline-block border-b border-brass pb-1 text-brass">
                Back to page 1
              </a>
            </>
          ) : (
            <p>Nothing matches this edit. Try fewer filters.</p>
          )}
        </div>
      )}

      <Pagination f={f} pages={pages} />
    </div>
  );
}
