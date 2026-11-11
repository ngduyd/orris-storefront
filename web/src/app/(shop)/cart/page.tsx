import Image from "next/image";
import Link from "next/link";
import { removeAction, setQtyAction } from "@/actions/cart";
import { currentCart } from "@/lib/cart-cookie";
import { usd } from "@/lib/money";
import { imageUrl } from "@/lib/image";

export const metadata = { title: "Bag" };

export default async function CartPage() {
  const { lines, totalMinor, count } = await currentCart();

  if (!lines.length) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-8">
        <p className="label">Bag</p>
        <h1 className="mt-3 font-serif text-4xl font-light">Your bag is empty.</h1>
        <Link href="/shop" className="label mt-8 inline-block border-b border-brass pb-1 text-brass-text">
          Browse the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-4xl font-light">Bag</h1>
        <p className="label">{count} item{count === 1 ? "" : "s"}</p>
      </div>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {lines.map((l) => (
          <li key={l.handle} className="flex gap-5 py-6">
            <Link href={`/product/${l.handle}`} className="relative size-24 shrink-0 bg-ivory-deep">
              <Image src={imageUrl(l.image, 200)} alt="" fill sizes="96px" className="fade-in object-contain p-2" />
            </Link>
            <div className="flex flex-1 flex-col justify-between sm:flex-row sm:items-center">
              <div>
                <p className="label">{l.brand}</p>
                <Link href={`/product/${l.handle}`} className="mt-1 block font-serif text-lg">{l.title}</Link>
                <p className="mt-1 text-xs text-taupe">{l.sizeMl} ml</p>
              </div>
              <div className="mt-3 flex items-center gap-4 sm:mt-0">
                <form action={setQtyAction} className="flex items-center border border-line">
                  <input type="hidden" name="handle" value={l.handle} />
                  <button name="qty" value={l.qty - 1} className="px-3 py-1 text-sm hover:text-brass-text" aria-label="Decrease quantity">−</button>
                  <span className="min-w-6 text-center text-sm">{l.qty}</span>
                  <button name="qty" value={l.qty + 1} className="px-3 py-1 text-sm hover:text-brass-text" aria-label="Increase quantity">+</button>
                </form>
                <form action={removeAction}>
                  <input type="hidden" name="handle" value={l.handle} />
                  <button className="label hover:text-ink">Remove</button>
                </form>
                <span className="w-24 shrink-0 text-right text-sm">{usd(l.priceMinor * l.qty)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-end justify-between">
        <p className="label">Subtotal · shipping at checkout</p>
        <p className="text-lg">{usd(totalMinor)}</p>
      </div>

      <div className="mt-8 flex justify-end">
        <Link href="/checkout" className="border border-ink px-8 py-3 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
          Checkout
        </Link>
      </div>
    </div>
  );
}
