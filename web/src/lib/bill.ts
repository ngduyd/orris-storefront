import { getOrder } from "@/lib/orders";
import { sendMail } from "@/lib/mail";
import { usd } from "@/lib/money";

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
