import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";

/**
 * Đơn của tài khoản = đơn gắn userId + đơn guest trước đây dùng cùng email.
 * Nhờ vậy khách đặt hàng trước khi tạo tài khoản vẫn thấy lịch sử.
 */
export async function listOrdersFor(user: { id: string; email: string }, limit = 50) {
  return db
    .select({
      id: orders.id,
      status: orders.status,
      paid: orders.paid,
      totalMinor: orders.totalMinor,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(or(eq(orders.userId, user.id), eq(orders.email, user.email)))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
