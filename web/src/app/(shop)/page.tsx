import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/shop/product-card";
import { currentUser } from "@/lib/auth";
import { wishedIn } from "@/lib/wishlist";
import { statsFor } from "@/lib/reviews";
import { getBrands, getFacets, listProducts } from "@/lib/products";
import { imageUrl } from "@/lib/image";
import { usd } from "@/lib/money";

// rendered per request: the page is personalised (wishlist) and must read env at runtime, not bake
// image URLs from whatever the CI builds with
export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ items: bestsellers }, { items: arrivals }, facets, brands] = await Promise.all([
    listProducts({ sort: "rating", limit: 8 }),
    listProducts({ sort: "new", limit: 4 }),
    getFacets(),
    getBrands(16),
  ]);

  const hero = bestsellers[0];
  const families = facets.byFamily
    .filter((f) => f.v && f.n >= 100)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const viewer = await currentUser();
  const wished = await wishedIn(viewer?.id, [...bestsellers, ...arrivals].map((p) => p.handle));
  const reviews = await statsFor([...bestsellers, ...arrivals].map((p) => p.handle));

  const genderCount = (g: string) => facets.byGender.find((x) => x.v === g)?.n ?? 0;
  const bottleCount = facets.byGender.reduce((s, g) => s + g.n, 0);

  return (
    <>
      {/* 1. Hero */}
      {hero ? (
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pt-14 pb-20 sm:px-8 md:grid-cols-2 md:pt-20">
          <div>
            <p className="label fade-up">Maison de parfum · Est. 2026</p>
            <h1 className="fade-up mt-6 font-serif text-5xl leading-[0.98] font-light sm:text-7xl" style={{ animationDelay: "90ms" }}>
              Scent,
              <br />
              edited.
            </h1>
            <p className="fade-up mt-6 max-w-md text-sm leading-relaxed text-ink-soft" style={{ animationDelay: "180ms" }}>
              {bottleCount.toLocaleString("en-US")} bottles, one point of view. Notes by pyramid,
              accords by family, houses from A to Z.
            </p>
            <div className="fade-up mt-9 flex items-center gap-6" style={{ animationDelay: "270ms" }}>
              <Link href="/shop" className="border border-ink px-7 py-3 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">
                Shop the collection
              </Link>
              <Link href="/shop?sort=rating" className="label link-underline border-b border-brass pb-1 text-brass-text">
                Most rated
              </Link>
            </div>
          </div>
          <Link href={`/product/${hero.handle}`} className="group relative aspect-4/5 overflow-hidden bg-ivory-deep">
            <Image
              src={imageUrl(hero.image, 1200)}
              alt={`${hero.brand} ${hero.title}`}
              fill
              sizes="(min-width:768px) 50vw, 100vw"
              priority
              className="fade-in object-contain p-10 transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.045]"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
              <div>
                <p className="label">{hero.brand}</p>
                <p className="font-serif text-lg">{hero.title}</p>
              </div>
              <p className="text-sm text-taupe">{usd(hero.priceMinor)}</p>
            </div>
          </Link>
        </section>
      ) : null}

      {/* 2. Shop by accord */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl font-light">Shop by family</h2>
          <Link href="/shop" className="label hover:text-ink">All families</Link>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {families.map((f) => (
            <li key={f.v}>
              <Link
                href={`/shop?family=${encodeURIComponent(f.v!)}`}
                className="flex h-28 flex-col justify-between bg-ivory p-5 transition-colors duration-500 ease-[var(--ease-out-soft)] hover:bg-ivory-deep"
              >
                <span className="font-serif text-xl">{f.v}</span>
                <span className="label">{f.n} bottles</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Bestsellers */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl font-light">Most rated</h2>
          <Link href="/shop?sort=rating" className="label hover:text-ink">See all</Link>
        </div>
        <div className="mt-8">
          <ProductGrid items={bestsellers} wished={wished} back="/" reviews={reviews} />
        </div>
      </section>

      {/* 4. Editorial split */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2">
        <div className="relative aspect-4/5 bg-ivory-deep md:aspect-3/2">
          {arrivals[0] ? (
            <Image
              src={imageUrl(arrivals[0].image, 1200)}
              alt=""
              fill
              sizes="(min-width:768px) 50vw, 100vw"
              className="object-contain p-8 md:p-12"
            />
          ) : null}
        </div>
        <div>
          <p className="label">The edit</p>
          <h2 className="mt-4 font-serif text-4xl leading-tight font-light">
            A pyramid is a promise:
            <br />
            top fades, base stays.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-ink-soft">
            Every bottle here lists its top, middle and base notes as the house published them. No
            invented accords, no sponsored rankings — the order you see is the data we hold.
          </p>
        </div>
      </section>

      {/* 5. Collections */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <h2 className="font-serif text-3xl font-light">Collections</h2>
        <ul className="mt-8 grid gap-px bg-line sm:grid-cols-3">
          {[
            ["Women", genderCount("Women")],
            ["Men", genderCount("Men")],
            ["Unisex", genderCount("Unisex")],
          ].map(([g, n]) => (
            <li key={g as string}>
              <Link
                href={`/shop?gender=${g}`}
                className="flex h-28 flex-col justify-between bg-ivory p-6 sm:h-40 transition-colors duration-500 ease-[var(--ease-out-soft)] hover:bg-ivory-deep"
              >
                <span className="font-serif text-3xl">{g}</span>
                <span className="label">{n} bottles</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 6. New arrivals */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl font-light">Newest releases</h2>
          <Link href="/shop?sort=new" className="label hover:text-ink">See all</Link>
        </div>
        <div className="mt-8">
          <ProductGrid items={arrivals} wished={wished} back="/" reviews={reviews} />
        </div>
      </section>

      {/* 7. Houses marquee */}
      <section className="border-y border-line py-10">
        <p className="label mx-auto mb-6 max-w-7xl px-5 sm:px-8">Houses we carry</p>
        <div className="overflow-hidden">
          <div className="marquee gap-12">
            {[...brands, ...brands].map((b, i) => (
              <Link
                key={`${b.brand}-${i}`}
                href={`/shop?brand=${encodeURIComponent(b.brand)}`}
                className="font-serif text-2xl whitespace-nowrap text-taupe transition-colors duration-300 hover:text-ink"
              >
                {b.brand}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Closing note */}
      <section className="mx-auto max-w-7xl px-5 py-24 text-center sm:px-8">
        <p className="label">No account needed</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-serif text-4xl leading-tight font-light">
          Browse openly. Order as a guest. Nothing is charged in this build.
        </h2>
        <Link href="/shop" className="label mt-8 inline-block border-b border-brass pb-1 text-brass-text">
          Enter the collection
        </Link>
      </section>
    </>
  );
}
