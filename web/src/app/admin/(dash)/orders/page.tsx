import Link from "next/link";
import { ADMIN_PAGE_SIZE, listOrders, type OrderStatus } from "@/lib/admin";
import { canManage, requireStaff } from "@/lib/auth";
import { releaseExpiredReservations } from "@/lib/orders";
import { orderStatus } from "@/db/schema";
import { usd } from "@/lib/money";

const FILTERS: (OrderStatus | "all")[] = ["all", ...orderStatus.enumValues];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = FILTERS.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  // a manager opening the list sweeps the holds that already ran out, so stock comes back
  await releaseExpiredReservations();
  const { items, total, pages } = await listOrders({ status, page });
  const staff = await requireStaff();
  const qs = (s?: OrderStatus) => (s ? `/admin/orders?status=${s}` : "/admin/orders");

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

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f === (status ?? "all");
          return (
            <Link
              key={f}
              href={f === "all" ? "/admin/orders" : qs(f as OrderStatus)}
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
          <Link href={`${qs(status)}${status ? "&" : "?"}page=${page - 1}`} aria-disabled={page <= 1} className={`label ${page <= 1 ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>
            ← Newer
          </Link>
          <span className="label">{page} / {pages}</span>
          <Link href={`${qs(status)}${status ? "&" : "?"}page=${page + 1}`} aria-disabled={page >= pages} className={`label ${page >= pages ? "pointer-events-none opacity-40" : "hover:text-ink"}`}>
            Older →
          </Link>
        </nav>
      ) : null}
      <p className="sr-only">{ADMIN_PAGE_SIZE} per page</p>
    </div>
  );
}
