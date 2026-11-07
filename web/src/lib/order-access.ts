import type { currentUser } from "@/lib/auth";

type Viewer = Awaited<ReturnType<typeof currentUser>>;

/**
 * Order visibility: the owning account, a manager, or an account whose email matches the order
 * AND whose email is verified. The last clause matters: without it, registering with someone
 * else's address would expose their orders.
 */
export function canAccessOrder(viewer: Viewer, order: { userId: string | null; email: string }) {
  if (!viewer) return false;
  if (viewer.role === "manager") return true;
  if (order.userId && order.userId === viewer.id) return true;
  return Boolean(viewer.emailVerifiedAt) && order.email.toLowerCase() === viewer.email.toLowerCase();
}
