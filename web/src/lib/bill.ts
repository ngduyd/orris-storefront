import { getOrder, markPaid, refundLatePayment } from "@/lib/orders";
import { sendMail } from "@/lib/mail";
import { usd } from "@/lib/money";
import { hit } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

/** Max shipping notices per order per hour: a carrier editing tracking must not mail-bomb the customer. */
const SHIPPING_NOTICES_PER_HOUR = 2;

/** Receipt sent once payment is confirmed. A mail failure must not break the flow. */
export async function sendBill(orderId: string, origin: string) {
  const order = await getOrder(orderId);
  if (!order) return;

  const lines = order.items
    .map((i) => `  ${i.qty} × ${i.title} — ${usd(i.priceMinor * i.qty)}`)
    .join("\n");

  const text = [
    `Thank you for your order at ORRIS.`,
    ``,
    `Order: ${order.id.slice(0, 8)}`,
    `Date: ${order.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
    ``,
    lines,
    ``,
    `Total: ${usd(order.totalMinor)}`,
    ``,
    `Ship to: ${order.customerName}`,
    order.address,
    ``,
    `View your order and shipping status: ${origin}/checkout/${order.id}`,
    ``,
    `This is your receipt for a paid order. Questions? Just reply to this email.`,
  ].join("\n");

  await sendMail({ to: order.email, subject: `ORRIS receipt · order ${order.id.slice(0, 8)}`, text });
}

/** Shipped / delivered notice. A mail failure must not break the status update. */
export async function sendShippingNotice(orderId: string, origin: string) {
  if (hit(`ship-notice:${orderId}`, SHIPPING_NOTICES_PER_HOUR, HOUR)) return;
  const order = await getOrder(orderId);
  if (!order) return;

  const delivered = order.status === "delivered";
  const shipping = [order.carrier, order.trackingCode].filter(Boolean).join(" · ");

  const text = [
    delivered ? `Your ORRIS order has been delivered.` : `Your ORRIS order is on its way.`,
    ``,
    `Order: ${order.id.slice(0, 8)}`,
    `Status: ${order.status}`,
    shipping ? `Shipping: ${shipping}` : null,
    ``,
    order.items.map((i) => `  ${i.qty} × ${i.title}`).join("\n"),
    ``,
    `Track the order and its status: ${origin}/checkout/${order.id}`,
    ``,
    `Questions? Just reply to this email.`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  await sendMail({
    to: order.email,
    subject: delivered ? `ORRIS order ${order.id.slice(0, 8)} delivered` : `ORRIS order ${order.id.slice(0, 8)} shipped`,
    text,
  });
}

/**
 * The one confirmation path for a paid session: webhook, success_url and the pay button all land
 * here. "paid" means this call marked it (receipt sent), "refunded" means the money went back.
 * A caller must never answer 200 on "failed".
 */
export async function confirmSessionPaid(
  orderId: string,
  sessionId: string,
  paymentIntent: string | null,
  origin: string,
): Promise<"paid" | "refunded" | "failed"> {
  if (await markPaid(orderId, sessionId, paymentIntent)) {
    await sendBill(orderId, origin);
    return "paid";
  }

  const order = await getOrder(orderId);
  if (!order) return "failed";
  if (order.paid) return "paid"; // the webhook (or another tab) confirmed it first: nothing to do
  if (order.status === "refunded") return "refunded"; // money already went back
  // cancelled or stock released: the hold is gone, so the payment cannot buy anything
  return (await refundLatePayment(orderId, sessionId, paymentIntent)) ? "refunded" : "failed";
}

/** Money went back or the order was killed: the customer must hear it, once. */
export async function sendOrderClosed(orderId: string, origin: string, reason: "cancelled" | "refunded") {
  const order = await getOrder(orderId);
  if (!order) return;
  const subject = reason === "cancelled" ? `Order ${orderId.slice(0, 8)} cancelled` : `Refund issued for order ${orderId.slice(0, 8)}`;
  const body =
    reason === "cancelled"
      ? `Order ${orderId.slice(0, 8)} was cancelled and nothing was charged.\n\nYour items are back in stock.\n\nView: ${origin}/checkout/${orderId}`
      : `We refunded ${usd(order.totalMinor)} for order ${orderId.slice(0, 8)}. It usually lands on your card within 5-10 business days.\n\nView: ${origin}/checkout/${orderId}`;
  try {
    await sendMail({ to: order.email, subject, text: body });
  } catch (e) {
    console.error("sendOrderClosed failed:", e instanceof Error ? e.message.slice(0, 100) : e);
  }
}
