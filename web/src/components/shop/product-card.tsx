import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { discountPercent, onSale, sarNote, usd } from "@/lib/money";
import { imageUrl } from "@/lib/image";
import { toggleWishlistAction } from "@/actions/wishlist";

export function ProductCard({ p, priority = false, wished = false, back = "/shop" }: { p: Product; priority?: boolean; wished?: boolean; back?: string }) {
  return (
    <div className="group relative">
      <Link href={`/product/${p.handle}`} className="block">
        <div className="relative aspect-4/5 overflow-hidden bg-ivory-deep">
          {onSale(p) ? (
            <span className="absolute top-2 left-2 z-10 bg-brass px-2 py-1 text-[0.6rem] uppercase tracking-[0.14em] text-ivory">
              −{discountPercent(p)}%
            </span>
          ) : null}
          <Image
            src={imageUrl(p.image, 600)}
            alt=""
            fill
            sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
            priority={priority}
            className="object-contain p-6 transition-transform duration-[900ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.045]"
          />
        </div>
      </Link>
      <form action={toggleWishlistAction} className="absolute top-2 right-2">
        <input type="hidden" name="handle" value={p.handle} />
        <input type="hidden" name="back" value={back} />
        <button
          aria-label={wished ? `Remove ${p.title} from wishlist` : `Save ${p.title} to wishlist`}
          className={`grid size-9 place-items-center bg-ivory/85 text-base leading-none backdrop-blur transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ivory ${wished ? "text-brass" : "text-taupe hover:text-ink"}`}
        >
          {wished ? "♥" : "♡"}
        </button>
      </form>
      <div className="pt-3">
        <Link href={`/shop?brand=${encodeURIComponent(p.brand)}`} className="label link-underline inline-flex min-h-6 items-center hover:text-ink">
          {p.brand}
        </Link>
        <h2 className="mt-1 font-serif text-lg leading-snug">
          <Link href={`/product/${p.handle}`} className="link-underline inline-flex min-h-6 items-center">{p.title}</Link>
        </h2>
        <p className="mt-1 flex items-baseline gap-2 text-sm text-ink-soft" title={sarNote(p.priceMinor)}>
          <span className={onSale(p) ? "text-brass" : undefined}>{usd(p.priceMinor)}</span>
          {onSale(p) ? <span className="text-xs text-taupe line-through">{usd(p.compareAtMinor!)}</span> : null}
          <span className="text-taupe">· {p.sizeMl}ml</span>
        </p>
        {p.rating !== null && p.ratingCount ? (
          <p className="mt-0.5 text-xs text-taupe">
            {Number(p.rating).toFixed(1)} / 5 · {p.ratingCount}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ProductGrid({ items, wished, back }: { items: Product[]; wished?: Set<string>; back?: string }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <ProductCard key={p.handle} p={p} priority={i < 4} wished={wished?.has(p.handle)} back={back} />
      ))}
    </div>
  );
}
