import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { CartCount } from "@/components/layout/cart-count";
import { currentStaff } from "@/lib/auth";

const NAV = [
  { href: "/shop?gender=Women", label: "Women" },
  { href: "/shop?gender=Men", label: "Men" },
  { href: "/shop?gender=Unisex", label: "Unisex" },
  { href: "/shop", label: "All" },
];
// desktop already shows "Account" on the right; the mobile nav row needs its own entry
const MOBILE_NAV = [...NAV, { href: "/account", label: "Account" }];

export async function SiteHeader() {
  const staff = await currentStaff();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:h-16 sm:px-8">
        <Link href="/" aria-label="ORRIS home">
          <Wordmark />
        </Link>
        <nav className="hidden gap-8 sm:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="label link-underline inline-flex min-h-6 items-center hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6">
          {staff ? (
            <Link href={staff.role === "carrier" ? "/admin/orders" : "/admin"} className="label link-underline inline-flex min-h-6 items-center text-brass-text hover:text-ink">
              Admin
            </Link>
          ) : null}
          <Link href="/account" className="label link-underline hidden min-h-6 items-center hover:text-ink sm:inline-flex">
            Account
          </Link>
          <Link href="/cart" className="label link-underline inline-flex min-h-6 items-center hover:text-ink">
            Bag
            <CartCount />
          </Link>
        </div>
      </div>

      {/* mobile: horizontally scrollable nav, no hamburger needed */}
      <nav className="flex gap-6 overflow-x-auto border-t border-line px-5 py-3 sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MOBILE_NAV.map((n) => (
          <Link key={n.href} href={n.href} className="label link-underline inline-flex min-h-6 shrink-0 items-center hover:text-ink">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-taupe">
            A curated house of fragrance. Notes, accords and houses, edited.
          </p>
        </div>
        <nav className="flex flex-wrap gap-6">
          <Link href="/terms" className="label link-underline hover:text-ink">Terms</Link>
          <Link href="/privacy" className="label link-underline hover:text-ink">Privacy</Link>
        </nav>
        <p className="label">Every bottle · every house</p>
      </div>
    </footer>
  );
}
