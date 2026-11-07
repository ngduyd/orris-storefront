import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listWishlist } from "@/lib/wishlist";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { imageUrl } from "@/lib/image";
import { usd } from "@/lib/money";
import { toggleWishlistAction } from "@/actions/wishlist";

export const metadata = { title: "Wishlist" };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const saved = await listWishlist(user.id);

  const rows = saved.length
    ? await db
        .select({ handle: products.handle, title: products.title, brand: products.brand, sizeMl: products.sizeMl, priceMinor: products.priceMinor, image: products.image, images: products.images, status: products.status })
        .from(products)
        .where(inArray(products.handle, saved.map((s) => s.handle)))
    : [];

  const order = new Map(saved.map((s, i) => [s.handle, i]));
  rows.sort((a, b) => (order.get(a.handle) ?? 0) - (order.get(b.handle) ?? 0));

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl font-light">Wishlist</h1>
        <p className="label">{rows.length} saved</p>
      </div>

      {rows.length ? (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {rows.map((p) => (
            <li key={p.handle} className="flex items-center gap-5 py-5">
              <Link href={`/product/${p.handle}`} className="relative size-20 shrink-0 bg-ivory-deep">
                <Image src={imageUrl(p.images[0] || p.image, 160)} alt="" fill sizes="80px" className="object-contain p-2" />
              </Link>
              <div className="flex-1">
                <p className="label">{p.brand}</p>
                <Link href={`/product/${p.handle}`} className="link-underline">{p.title}</Link>
                <p className="mt-1 text-xs text-taupe">
                  {p.sizeMl} ml · {usd(p.priceMinor)}
                  {p.status !== "active" ? " · no longer sold" : ""}
                </p>
              </div>
              <form action={toggleWishlistAction}>
                <input type="hidden" name="handle" value={p.handle} />
                <input type="hidden" name="back" value="/account/wishlist" />
                <button className="label min-h-6 text-taupe hover:text-ink">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-taupe">
          Nothing saved yet.{" "}
          <Link href="/shop" className="link-underline text-ink">Browse the collection</Link>
        </p>
      )}
    </div>
  );
}
