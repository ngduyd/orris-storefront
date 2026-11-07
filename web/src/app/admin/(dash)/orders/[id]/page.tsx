import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelOrderAction, refundOrderAction, saveOrderStatusAction, saveShippingAction } from "@/actions/admin";
import { getOrderDetail, type OrderStatus } from "@/lib/admin";
import { orderStatus } from "@/db/schema";
import { canManage, requireStaff } from "@/lib/auth";
import { usd } from "@/lib/money";

const SHIPPING_STATUSES: OrderStatus[] = ["processing", "shipped", "delivered"];

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; by?: string; error?: string }>;
}) {
  const staff = await requireStaff();
  const { id } = await params;
  const { saved, error } = await searchParams;
  const data = await getOrderDetail(id);
  if (!data) notFound();
  const { order, items } = data;
  const manager = canManage(staff.role);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/orders" className="label link-underline hover:text-ink">← Orders</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">Order {order.id.slice(0, 8)}</h1>
        <p className="label">{order.createdAt.toISOString().slice(0, 16).replace("T", " ")}</p>
      </div>
      {saved ? <p className="mt-3 text-sm text-brass">Saved.</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-brass">
          {error === "norefund" ? "Only a paid order can be refunded." : "Only a pending order can be cancelled."}
        </p>
      ) : null}

      <table className="mt-8 w-full border-collapse text-sm">
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-line/60">
              <td className="py-3">
                <Link href={`/product/${i.handle}`} className="link-underline">{i.title}</Link>
                <span className="block text-xs text-taupe">{i.handle}</span>
              </td>
              <td className="py-3 text-right text-taupe">× {i.qty}</td>
              <td className="w-24 py-3 text-right">{usd(i.priceMinor * i.qty)}</td>
            </tr>
          ))}
          <tr>
            <td className="label py-3">Total</td>
            <td />
            <td className="py-3 text-right">{usd(order.totalMinor)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="mt-8 grid gap-3 border-t border-line pt-6 text-sm">
        {[
          ["Email", order.email],
          ["Name", order.customerName || "—"],
          ["Address", order.address || "—"],
          ["Status", order.status],
          ["Paid", order.paid ? "yes" : "no"],
          ["Carrier", order.carrier || "—"],
          ["Tracking", order.trackingCode || "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-6">
            <dt className="label pt-0.5">{k}</dt>
            <dd className="text-right text-ink-soft">{v}</dd>
          </div>
        ))}
      </dl>

      <form action={saveShippingAction} className="mt-8 flex flex-wrap items-end gap-3 border-t border-line pt-6">
        <input type="hidden" name="id" value={order.id} />
        <label className="block">
          <span className="label">Carrier</span>
          <input name="carrier" defaultValue={order.carrier ?? ""} placeholder="Aramex, SMSA…" className="mt-2 w-44 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none" />
        </label>
        <label className="block">
          <span className="label">Tracking code</span>
          <input name="trackingCode" defaultValue={order.trackingCode ?? ""} className="mt-2 w-44 border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none" />
        </label>
        <label className="block">
          <span className="label">Shipping status</span>
          <select name="status" defaultValue={SHIPPING_STATUSES.includes(order.status) ? order.status : "processing"} className="mt-2 block border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none">
            {SHIPPING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button className="border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
          Update shipment
        </button>
        <p className="w-full text-xs text-taupe">
          {manager ? "Managers and carriers can both update this." : "The carrier role can only update this section."}
        </p>
      </form>

      {manager ? (
        <form action={saveOrderStatusAction} className="mt-8 flex flex-wrap items-end gap-3 border-t border-line pt-6">
          <input type="hidden" name="id" value={order.id} />
          <label className="block">
            <span className="label">Order status (manager)</span>
            <select name="status" defaultValue={order.status} className="mt-2 block border border-line bg-transparent px-3 py-2 text-sm focus:border-ink focus:outline-none">
              {orderStatus.enumValues.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button className="border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">Save</button>
          <span className="text-xs text-taupe">paid becomes true for status paid/processing/shipped/delivered</span>
        </form>
      ) : null}

      {manager && order.status === "pending" ? (
        <form action={cancelOrderAction} className="mt-8 flex items-center gap-3 border-t border-line pt-6">
          <input type="hidden" name="id" value={order.id} />
          <button className="border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
            Cancel order
          </button>
          <span className="text-xs text-taupe">Returns the stock to the shelf and marks the order cancelled.</span>
        </form>
      ) : null}

      {manager && order.paid ? (
        <form action={refundOrderAction} className="mt-8 flex items-center gap-3 border-t border-line pt-6">
          <input type="hidden" name="id" value={order.id} />
          <button className="border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
            Refund
          </button>
          <span className="text-xs text-taupe">Refunds the card when Stripe knows the payment, then returns the stock.</span>
        </form>
      ) : null}
    </div>
  );
}
