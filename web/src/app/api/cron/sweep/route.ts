import { releaseExpiredReservations } from "@/lib/orders";

/**
 * Vercel Cron hits this: on a server the sweep runs when a manager opens /admin/orders, but a
 * serverless deployment has no such trigger, so expired stock holds would never be returned.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const released = await releaseExpiredReservations();
  return Response.json({ ok: true, released });
}
