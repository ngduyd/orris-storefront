import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { payAction } from "@/actions/pay";
import { cancelMyOrderAction, requestReturnAction } from "@/actions/order";
import { canRequestReturn, getOrder, selfCancelFor } from "@/lib/orders";
import { currentUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/order-access";
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
  const { paid, cancel, error, cancelled, refunded, return: returned } = await searchParams;
  const order = await getOrder(id);
  if (!order) notFound();

  const viewer = await currentUser();
  // not signed in: send them through login and straight back, instead of a dead 404
  if (!viewer) redirect(`/account/login?next=${encodeURIComponent(`/checkout/${order.id}`)}`);
  const owns = canAccessOrder(viewer, order);
  if (!owns) notFound();

  const canPay = stripeEnabled && !order.paid && order.status === "pending" && !order.stockReleased;
  const mode = selfCancelFor(order.status);

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
      {refunded ? <p className="mt-6 text-sm text-brass">The hold on this order had ended, so the payment was refunded automatically.</p> : null}
      {error === "stripe" ? <p className="mt-6 text-sm text-taupe">Card payment is not configured.</p> : null}
      {error === "session" ? <p className="mt-6 text-sm text-brass">This payment session expired — place the order again.</p> : null}
      {error === "hold" ? <p className="mt-6 text-sm text-brass">This hold expired — place the order again.</p> : null}
      {error === "busy" ? <p className="mt-6 text-sm text-taupe">Payment is already starting — refresh in a moment.</p> : null}
      {error === "refund" ? <p className="mt-6 text-sm text-brass">Payment could not be confirmed or refunded — we will sort it out by email.</p> : null}
      {error === "inprogress" ? <p className="mt-6 text-sm text-taupe">This order is already being prepared. Reply to your confirmation email and we will sort it out.</p> : null}
      {error === "norefund" ? <p className="mt-6 text-sm text-brass">The refund did not go through. Nothing was changed — please try again.</p> : null}
      {refunded === "1" ? <p className="mt-6 text-sm text-taupe">Refunded. It lands on your card within a few business days.</p> : null}
      {error === "return" ? <p className="mt-6 text-sm text-taupe">A return was already requested for this order.</p> : null}

      {owns && mode === "cancel" ? (
        <form action={cancelMyOrderAction} className="mt-6">
          <input type="hidden" name="orderId" value={order.id} />
          <button className="label border-b border-taupe pb-1 text-taupe hover:text-ink">Cancel order</button>
        </form>
      ) : null}
      {returned === "1" ? <p className="mt-6 text-sm text-taupe">Return requested. We will reply by email once it is reviewed.</p> : null}
      {order.returnStatus === "requested" ? <p className="mt-6 text-sm text-taupe">Return requested — waiting for review.</p> : null}
      {order.returnStatus === "rejected" ? <p className="mt-6 text-sm text-brass">Return refused. Reply to your confirmation email if you want us to look again.</p> : null}

      {owns && canRequestReturn(order) ? (
        <form action={requestReturnAction} className="mt-6 max-w-md border-t border-line pt-6">
          <input type="hidden" name="orderId" value={order.id} />
          <label htmlFor="reason" className="label text-taupe">Why are you sending it back?</label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            maxLength={300}
            required
            className="mt-2 w-full border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
          <button className="mt-3 border border-ink px-6 py-2.5 text-[0.7rem] uppercase tracking-[0.18em] hover:bg-ink hover:text-ivory">
            Request a return
          </button>
        </form>
      ) : null}

      {owns && mode === "refund" ? (
        <form action={cancelMyOrderAction} className="mt-6">
          <input type="hidden" name="orderId" value={order.id} />
          <button className="label border-b border-brass pb-1 text-brass hover:text-ink">Cancel and refund</button>
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

      <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-taupe">Subtotal</span>
          <span>{usd(order.subtotalMinor)}</span>
        </div>
        {order.shippingMinor > 0 ? (
          <div className="flex justify-between">
            <span className="text-taupe">Shipping</span>
            <span>{usd(order.shippingMinor)}</span>
          </div>
        ) : null}
        {order.discountMinor > 0 ? (
          <div className="flex justify-between">
            <span className="text-taupe">Discount{order.couponCode ? ` · ${order.couponCode}` : ""}</span>
            <span>−{usd(order.discountMinor)}</span>
          </div>
        ) : null}
        <div className="flex justify-between pt-1">
          <span className="label">Total</span>
          <span>{usd(order.totalMinor)}</span>
        </div>
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <p className="label">Progress</p>
        <ol className="mt-4 space-y-3 text-sm">
          {STEPS.map((step) => {
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
          <dd className="max-w-xs text-right text-ink-soft">
            {order.address}
            {order.phone ? <span className="block text-taupe">{order.phone}</span> : null}
          </dd>
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
