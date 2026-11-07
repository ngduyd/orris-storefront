import { desc } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { currentStaff } from "@/lib/auth";

const COLUMNS = ["id", "created_at", "status", "paid", "email", "customer", "total_minor", "carrier", "tracking_code"];

/** always quote: an address or name may contain a comma, quote or newline */
const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Manager-only orders export. */
export async function GET() {
  const staff = await currentStaff();
  if (!staff || staff.role !== "manager") return new Response("forbidden", { status: 403 });

  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const csv = [
    COLUMNS.join(","),
    ...rows.map((o) =>
      [
        o.id,
        o.createdAt.toISOString(),
        o.status,
        o.paid,
        o.email,
        o.customerName,
        o.totalMinor,
        o.carrier,
        o.trackingCode,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orris-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
