import Link from "next/link";
import { recentOrders, stats } from "@/lib/admin";
import { usd } from "@/lib/money";

export default async function AdminOverview() {
  const [{ products: p, orders: byStatus }, latest] = await Promise.all([stats(), recentOrders()]);
  const pending = byStatus.find((s) => s.status === "pending");

  const cards = [
    { label: "Active products", value: p.active.toLocaleString("en-US"), href: "/admin/products?status=active" },
    { label: "Drafts", value: String(p.draft), href: "/admin/products?status=draft" },
    { label: "Low stock (<5)", value: String(p.lowStock), href: "/admin/products" },
    { label: "Pending orders", value: String(pending?.n ?? 0), href: "/admin/orders?status=pending" },
    { label: "Pending value", value: usd(pending?.total ?? 0), href: "/admin/orders?status=pending" },
  ];

  return (
    <div>
      <h1 className="font-serif text-3xl font-light">Overview</h1>

      <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="block bg-ivory px-4 py-5 transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ivory-deep">
            <p className="label">{c.label}</p>
            <p className="mt-2 font-serif text-2xl font-light">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="label">Latest orders</h2>
        <Link href="/admin/orders" className="label link-underline hover:text-ink">All orders</Link>
      </div>

      {latest.length ? (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label py-2 font-normal">Order</th>
              <th className="label py-2 font-normal">Customer</th>
              <th className="label py-2 font-normal">Status</th>
              <th className="label py-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((o) => (
              <tr key={o.id} className="border-b border-line/60">
                <td className="py-3">
                  <Link href={`/admin/orders/${o.id}`} className="link-underline">
                    {o.id.slice(0, 8)} · {o.createdAt.toISOString().slice(0, 10)}
                  </Link>
                </td>
                <td className="py-3 text-ink-soft">{o.customerName || o.email}</td>
                <td className="py-3 text-taupe">{o.status}</td>
                <td className="py-3 text-right">{usd(o.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-taupe">No orders yet.</p>
      )}
    </div>
  );
}
