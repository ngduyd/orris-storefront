import { getOrder } from "@/lib/orders";
import { sendMail } from "@/lib/mail";
import { usd } from "@/lib/money";

/** Hoá đơn gửi sau khi đơn được xác nhận thanh toán. Lỗi mail không được làm hỏng luồng. */
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
