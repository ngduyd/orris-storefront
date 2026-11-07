import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";

/**
 * Account orders = orders carrying userId + guest orders previously placed with the same email.
 * So a customer who ordered before signing up still sees the history.
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
