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
    `Cảm ơn bạn đã đặt hàng tại ORRIS.`,
    ``,
    `Đơn: ${order.id.slice(0, 8)}`,
    `Ngày: ${order.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC`,
    ``,
    lines,
    ``,
    `Tổng: ${usd(order.totalMinor)}`,
    ``,
    `Giao đến: ${order.customerName}`,
    order.address,
    ``,
    `Xem đơn và trạng thái vận chuyển: ${origin}/checkout/${order.id}`,
    ``,
    `Đây là hoá đơn cho đơn hàng đã thanh toán. Mọi câu hỏi: trả lời email này.`,
  ].join("\n");

  await sendMail({ to: order.email, subject: `Hoá đơn ORRIS · đơn ${order.id.slice(0, 8)}`, text });
}
