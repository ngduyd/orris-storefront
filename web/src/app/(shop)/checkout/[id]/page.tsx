import Link from "next/link";
import { notFound } from "next/navigation";
import { payAction } from "@/actions/pay";
import { cancelMyOrderAction } from "@/actions/order";
import { getOrder } from "@/lib/orders";
import { currentUser } from "@/lib/auth";
import { stripeEnabled } from "@/lib/stripe";
import { usd } from "@/lib/money";

export const metadata = { title: "Order placed" };

const STEPS = [
  { status: "pending", label: "Placed" },
  { status: "paid", label: "Paid" },
  { status: "processing", label: "Preparing" },
  { status: "shipped", label: "In transit" },
  { status: "delivered", label: "Delivered" },
];
const STEP_ORDER = ["pending", "paid", "processing", "shipped", "delivered"];

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  const { paid, cancel, error, cancelled } = await searchParams;
  const order = await getOrder(id);
  if (!order) notFound();

  const viewer = await currentUser();
  const owns = viewer && (order.userId === viewer.id || order.email === viewer.email);
  if (!owns && viewer?.role !== "manager") notFound();

  const canPay = stripeEnabled && !order.paid && order.status === "pending" && !order.stockReleased;

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <p className="label">Order {order.id.slice(0, 8)}</p>
      <h1 className="mt-3 font-serif text-4xl font-light">
        {order.paid ? "Payment received." : "Thank you."}
      </h1>
      <p className="mt-4 text-sm text-ink-soft">
        {order.paid ? (
          <>Paid with card. A confirmation would normally go to {order.email}.</>
        ) : (
          <>
            Your order is recorded as <strong className="font-normal">{order.status}</strong> and nothing was charged
            yet. A confirmation would normally go to {order.email}.
          </>
        )}
      </p>

      {canPay ? (
        <form action={payAction} className="mt-8 border border-line p-5">
          <p className="label">Card payment · Stripe test mode</p>
          <p className="mt-2 text-xs leading-relaxed text-taupe">
            Test card 4242 4242 4242 4242, any future expiry, any CVC. No money moves.
          </p>
          <input type="hidden" name="orderId" value={order.id} />
          <button className="mt-4 w-full border border-ink px-6 py-3 text-[0.7rem] uppercase tracking-[0.18em] transition-colors duration-300 ease-[var(--ease-out-soft)] hover:bg-ink hover:text-ivory">
            Pay {usd(order.totalMinor)}
          </button>
        </form>
      ) : null}

      {!order.paid && paid ? (
        <p className="mt-6 text-sm text-brass">Payment is being confirmed — refresh in a moment.</p>
      ) : null}
      {cancel ? <p className="mt-6 text-sm text-taupe">Payment cancelled. Your order stays pending.</p> : null}
      {cancelled ? <p className="mt-6 text-sm text-brass">Order cancelled. The items are back in stock.</p> : null}
      {error === "stripe" ? <p className="mt-6 text-sm text-taupe">Card payment is not configured.</p> : null}

      {owns && order.status === "pending" ? (
        <form action={cancelMyOrderAction} className="mt-6">
          <input type="hidden" name="orderId" value={order.id} />
          <button className="label border-b border-taupe pb-1 text-taupe hover:text-ink">Cancel order</button>
        </form>
      ) : null}

      <ul className="mt-10 divide-y divide-line border-y border-line text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 py-3">
            <span className="text-ink-soft">
              {i.title} <span className="text-taupe">× {i.qty}</span>
            </span>
            <span>{usd(i.priceMinor * i.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-between text-sm">
        <span className="label">Total</span>
        <span>{usd(order.totalMinor)}</span>
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <p className="label">Progress</p>
        <ol className="mt-4 space-y-3 text-sm">
          {STEPS.map((step, i) => {
            const done = STEP_ORDER.indexOf(order.status) >= STEP_ORDER.indexOf(step.status);
            return (
              <li key={step.status} className="flex items-center gap-3">
                <span className={`size-2 rounded-full ${done ? "bg-brass" : "bg-line"}`} aria-hidden="true" />
                <span className={done ? "text-ink" : "text-taupe"}>{step.label}</span>
                {step.status === "shipped" && order.carrier ? (
                  <span className="text-xs text-taupe">
                    {order.carrier}{order.trackingCode ? ` · ${order.trackingCode}` : ""}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        {order.status === "cancelled" || order.status === "refunded" ? (
          <p className="mt-3 text-sm text-brass">This order was {order.status === "cancelled" ? "cancelled" : "refunded"}.</p>
        ) : null}
      </div>

      <dl className="mt-10 space-y-2 border-t border-line pt-6 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="label">Ship to</dt>
          <dd className="text-right text-ink-soft">{order.customerName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="label">Address</dt>
          <dd className="max-w-xs text-right text-ink-soft">{order.address}</dd>
        </div>
      </dl>

      <Link href="/shop" className="label mt-12 inline-block border-b border-brass pb-1 text-brass">
        Keep browsing
      </Link>
      <Link href={`/checkout/${order.id}/invoice`} className="label mt-6 block border-b border-line pb-1 text-ink-soft hover:text-ink">
        Print invoice
      </Link>
    </div>
  );
}
