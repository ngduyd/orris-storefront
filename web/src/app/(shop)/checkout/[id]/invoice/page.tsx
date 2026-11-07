import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { PrintButton } from "@/components/shop/print-button";
import { currentUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/order-access";
import { usd } from "@/lib/money";
import { getOrder } from "@/lib/orders";

export const metadata = { title: "Invoice" };

const date = (d: Date) => d.toISOString().slice(0, 10);

/** Printable invoice. Same ownership rule as the order page: the owner or a manager. */
export default async function InvoicePage({ params }: PageProps<"/checkout/[id]/invoice">) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const viewer = await currentUser();
  // not signed in: send them through login and straight back, instead of a dead 404
  if (!viewer) redirect(`/account/login?next=${encodeURIComponent(`/checkout/${order.id}`)}`);
  const owns = canAccessOrder(viewer, order);
  if (!owns) notFound();

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Wordmark />
          <p className="label mt-4">Invoice</p>
        </div>
        <div className="text-right text-sm text-ink-soft">
          <p>Order {order.id.slice(0, 8)}</p>
          <p className="text-taupe">{date(order.createdAt)}</p>
        </div>
      </div>

      <table className="mt-10 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label py-2 font-normal">Item</th>
            <th className="label py-2 font-normal">Qty</th>
            <th className="label py-2 text-right font-normal">Price</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-line/60">
              <td className="py-3 text-ink-soft">{i.title}</td>
              <td className="py-3 text-taupe">{i.qty}</td>
              <td className="py-3 text-right">{usd(i.priceMinor * i.qty)}</td>
            </tr>
          ))}
          <tr>
            <td className="label py-3">Total</td>
            <td />
            <td className="py-3 text-right">{usd(order.totalMinor)}</td>
          </tr>
        </tbody>
      </table>

      <dl className="mt-8 grid gap-3 border-t border-line pt-6 text-sm sm:grid-cols-2">
        <div>
          <dt className="label">Ship to</dt>
          <dd className="mt-2 text-ink-soft">
            {order.customerName}
            <br />
            {order.address}
          </dd>
        </div>
        <div className="sm:text-right">
          <dt className="label">Status</dt>
          <dd className="mt-2 text-ink-soft">
            {order.status}
            {order.paid ? " · paid" : " · unpaid"}
            {order.carrier ? (
              <>
                <br />
                {order.carrier}
                {order.trackingCode ? ` · ${order.trackingCode}` : ""}
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6 print:hidden">
        <Link href={`/checkout/${order.id}`} className="label link-underline hover:text-ink">
          ← Order
        </Link>
        <PrintButton />
      </div>

      <p className="mt-8 text-xs text-taupe">
        ORRIS · ORRIS test store · card payments run in Stripe test mode, no money moves.
      </p>
    </div>
  );
}
