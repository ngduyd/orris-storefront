import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { countOrdersFor, listOrdersFor } from "@/lib/account";
import { usd } from "@/lib/money";

export const metadata = { title: "Your orders" };

const PER_PAGE = 10;

export default async function AccountOrders({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const me = await currentUser();
  if (!me) redirect(`/account/login?next=${encodeURIComponent("/account/orders")}`);

  const { page } = await searchParams;
  const asked = Number.parseInt(page ?? "1", 10);
  const total = await countOrdersFor(me);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1;

  const rows = await listOrdersFor(me, PER_PAGE, (current - 1) * PER_PAGE);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="label">Account</p>
      <h1 className="mt-3 font-serif text-4xl font-light">Orders</h1>
      <p className="mt-3 text-sm text-ink-soft">
        {total ? `${total} order${total === 1 ? "" : "s"}` : "Nothing yet."}
      </p>

      {rows.length ? (
        <table className="mt-10 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label py-2 font-normal">Order</th>
              <th className="label py-2 font-normal">Placed</th>
              <th className="label py-2 font-normal">Status</th>
              <th className="label py-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-line/60">
                <td className="py-3">
                  <Link href={`/account/orders/${o.id}`} className="link-underline">{o.id.slice(0, 8)}</Link>
                </td>
                <td className="py-3 text-taupe">{o.createdAt.toISOString().slice(0, 10)}</td>
                <td className="py-3 text-ink-soft">{o.paid ? "paid" : o.status}</td>
                <td className="py-3 text-right">{usd(o.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-8 text-sm text-taupe">
          No orders yet.{" "}
          <Link href="/shop" className="link-underline text-ink">Browse the collection</Link>
        </p>
      )}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-between border-t border-line pt-5 text-sm" aria-label="Pagination">
          {current > 1 ? (
            <Link href={`/account/orders?page=${current - 1}`} className="label text-ink-soft hover:text-ink">
              ← Newer
            </Link>
          ) : (
            <span className="label text-line">← Newer</span>
          )}
          <span className="text-xs text-taupe">Page {current} of {pages}</span>
          {current < pages ? (
            <Link href={`/account/orders?page=${current + 1}`} className="label text-ink-soft hover:text-ink">
              Older →
            </Link>
          ) : (
            <span className="label text-line">Older →</span>
          )}
        </nav>
      ) : null}

      <Link href="/account" className="label mt-12 inline-block border-b border-line pb-1 text-ink-soft hover:text-ink">
        Account settings
      </Link>
    </div>
  );
}
