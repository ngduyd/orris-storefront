import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { canManage, requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff · ORRIS" };

const MANAGER_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/brands", label: "Brands" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/stats", label: "Sales" },
  { href: "/admin/audit", label: "Audit" },
];
const CARRIER_NAV = [{ href: "/admin/orders", label: "Orders" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const nav = canManage(staff.role) ? MANAGER_NAV : CARRIER_NAV;

  return (
    <div className="min-h-svh bg-ivory">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
          <Link href={nav[0].href} className="label text-ink">
            ORRIS · {canManage(staff.role) ? "Manager" : "Carrier"}
          </Link>
          <nav className="flex gap-6">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="label link-underline inline-flex min-h-6 items-center hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-6">
            <Link href="/" className="label link-underline inline-flex min-h-6 items-center hover:text-ink">Shop</Link>
            <form action={logoutAction}>
              <button className="label min-h-6 hover:text-ink">Sign out ({staff.email})</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  );
}
