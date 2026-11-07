import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserDetail } from "@/lib/admin";
import { requireManager } from "@/lib/auth";
import { usd } from "@/lib/money";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  await requireManager();
  const { id } = await params;
  const data = await getUserDetail(id);
  if (!data) notFound();
  const { user, orders, spendMinor, paidCount } = data;

  return (
    <div>
      <Link href="/admin/users" className="label link-underline hover:text-ink">← Users</Link>
      <h1 className="mt-6 font-serif text-3xl font-light">{user.email}</h1>
      <dl className="mt-6 grid gap-3 border-y border-line py-5 text-sm sm:grid-cols-4">
        {[
          ["Role", user.role],
          ["Verified", user.emailVerifiedAt ? "yes" : "no"],
          ["Joined", user.createdAt.toISOString().slice(0, 10)],
          ["Paid orders", `${paidCount} · ${usd(spendMinor)}`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd className="mt-1 text-ink-soft">{v}</dd>
          </div>
        ))}
      </dl>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 font-normal">Order</th>
            <th className="label py-2 font-normal">Placed</th>
            <th className="label py-2 font-normal">Status</th>
            <th className="label py-2 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-line/60">
              <td className="py-3">
                <Link href={`/admin/orders/${o.id}`} className="link-underline">{o.id.slice(0, 8)}</Link>
              </td>
              <td className="py-3 text-taupe">{o.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="py-3 text-taupe">{o.status}</td>
              <td className="py-3 text-right">{usd(o.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length ? <p className="mt-6 text-sm text-taupe">No orders yet.</p> : null}
    </div>
  );
}
