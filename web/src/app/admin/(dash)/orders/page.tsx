import Link from "next/link";
import { ADMIN_PAGE_SIZE, listOrders, type OrderStatus } from "@/lib/admin";
import { canManage, requireStaff } from "@/lib/auth";
import { releaseExpiredReservations } from "@/lib/orders";
import { orderStatus } from "@/db/schema";
import { usd } from "@/lib/money";

const FILTERS: (OrderStatus | "all")[] = ["all", ...orderStatus.enumValues];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  const staff = await requireStaff(); // guard first: the sweep below writes to the DB
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 60) || undefined;
  // a manager opening the list sweeps the holds that already ran out, so stock comes back
  await releaseExpiredReservations();
  const { items, total, pages } = await listOrders({ status, page, q });
  const qs = (s?: OrderStatus) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    return p.size ? `/admin/orders?${p}` : "/admin/orders";
  };
  const pageQs = (n: number) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    p.set("page", String(n));
    return `/admin/orders?${p}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">Orders</h1>
        <div className="flex items-center gap-6">
          <p className="label">{total.toLocaleString("en-US")} total · page {page}</p>
          {canManage(staff.role) ? (
            <Link href="/admin/orders/export" prefetch={false} className="label link-underline hover:text-ink">Export CSV</Link>
          ) : null}
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-2" action="/admin/orders">
        <input name="q" defaultValue={q} placeholder="Order id, customer name or email" className="min-w-64 flex-1 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none" />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button className="border border-ink px-5 py-2 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f === (status ?? "all");
          return (
            <Link
              key={f}
              href={qs(f === "all" ? undefined : (f as OrderStatus))}
              className={`border px-3 py-1.5 text-xs transition-colors duration-300 ease-[var(--ease-out-soft)] ${active ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft hover:border-ink"}`}
            >
              {f}
            </Link>
          );
        })}
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 font-normal">Order</th>
            <th className="label py-2 font-normal">Customer</th>
            <th className="label py-2 font-normal">Status</th>
            <th className="label py-2 font-normal">Paid</th>
            <th className="label py-2 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id} className="border-b border-line/60">
              <td className="py-3">
                <Link href={`/admin/orders/${o.id}`} className="link-underline">{o.id.slice(0, 8)}</Link>
                <span className="ml-2 text-xs text-taupe">{o.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
              </td>
              <td className="py-3 text-ink-soft">{o.customerName || "—"}<span className="block text-xs text-taupe">{o.email}</span></td>
              <td className="py-3 text-taupe">{o.status}</td>
              <td className="py-3 text-taupe">{o.paid ? "yes" : "no"}</td>
              <td className="py-3 text-right">{usd(o.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!items.length ? <p className="mt-6 text-sm text-taupe">Nothing here.</p> : null}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-between">
          <Link href={pageQs(page - 1)} aria-disabled={page <= 1} className={`label ${page <= 1 ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>
            ← Newer
          </Link>
          <span className="label">{page} / {pages}</span>
          <Link href={pageQs(page + 1)} aria-disabled={page >= pages} className={`label ${page >= pages ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>
            Older →
          </Link>
        </nav>
      ) : null}
      <p className="sr-only">{ADMIN_PAGE_SIZE} per page</p>
    </div>
  );
}
