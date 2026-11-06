import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "product.update"
  | "order.status"
  | "order.shipping"
  | "user.role";

export async function writeAudit(entry: {
  actorId?: string | null;
  actorEmail: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  detail?: string;
}) {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    detail: entry.detail,
  });
}

export const AUDIT_PAGE_SIZE = 50;

export async function listAudit({ action, page }: { action?: string; page: number }) {
  const where = action ? eq(auditLogs.action, action) : undefined;
  const [items, [c]] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(AUDIT_PAGE_SIZE).offset((page - 1) * AUDIT_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);
  const actions = await db.select({ a: auditLogs.action }).from(auditLogs).groupBy(auditLogs.action);
  return { items, total: c.n, pages: Math.max(1, Math.ceil(c.n / AUDIT_PAGE_SIZE)), actions: actions.map((r) => r.a) };
}
