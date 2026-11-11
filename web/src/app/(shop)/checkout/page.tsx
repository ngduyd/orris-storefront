import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { currentCart } from "@/lib/cart-cookie";
import { currentUser } from "@/lib/auth";
import { usd } from "@/lib/money";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { lines, totalMinor, count } = await currentCart();
  const user = await currentUser();
  if (!user) redirect("/account/login?next=%2Fcheckout");
  if (!lines.length) redirect("/cart");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <h1 className="font-serif text-4xl font-light">Checkout</h1>
      {error === "slow" ? (
        <p role="alert" className="mt-6 border border-line bg-ivory-deep px-4 py-3 text-sm text-brass-text">
          Too many checkout attempts from this network. Try again in an hour.
        </p>
      ) : null}

      <div className="mt-10 grid gap-12 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="label">Contact & shipping</p>
          <CheckoutForm email={user.email} />
        </div>

        <aside className="border border-line p-6">
          <p className="label">Order · {count} item{count === 1 ? "" : "s"}</p>
          <ul className="mt-4 space-y-3 text-sm">
            {lines.map((l) => (
              <li key={l.handle} className="flex justify-between gap-4">
                <Link href={`/product/${l.handle}`} className="text-ink-soft hover:text-ink">
                  {l.brand} {l.title} <span className="text-taupe">× {l.qty}</span>
                </Link>
                <span className="shrink-0">{usd(l.priceMinor * l.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-between border-t border-line pt-4 text-sm">
            <span className="label">Total</span>
            <span>{usd(totalMinor)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
