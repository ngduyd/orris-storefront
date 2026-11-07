"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getOrder } from "@/lib/orders";
import { confirmSessionPaid } from "@/lib/bill";
import { currentUser } from "@/lib/auth";
import { canAccessOrder } from "@/lib/order-access";
import { usdMinor } from "@/lib/money";
import { stripe } from "@/lib/stripe";

/**
 * Stripe refuses an expires_at under 30 minutes from now, so a legal session is 30-31 minutes.
 * The stock hold (35 minutes) is longer on purpose: the session always dies before the hold does.
 */
const SESSION_MINUTES = 31;
const STRIPE_MIN_MINUTES = 30;
/** A hold may be extended once at pay time, but never past this order age: stock is not held forever. */
const HOLD_CAP_MINUTES = 90;
/** Written into stripe_id by the claim so a second click cannot create a second session. */
const CLAIM_STALE_MS = 2 * 60 * 1000;
/** Placeholder claim: `claim:<orderId>:<epochMillis>` so a crashed attempt can be reclaimed. */
const claimKey = (orderId: string) => `claim:${orderId}:${Date.now()}`;
const isClaim = (id: string | null | undefined) => Boolean(id?.startsWith("claim:"));
const claimEpoch = (id: string) => Number(id.split(":")[2] ?? 0);

const outcomeQuery = (outcome: "paid" | "refunded" | "failed") =>
  outcome === "refunded" ? "?refunded=1" : outcome === "failed" ? "?error=refund" : "";

/** Reuse a stored session: open -> send the buyer back to it, complete -> confirm it. */
async function redirectToStoredSession(gateway: Stripe, orderId: string, stripeId: string, origin: string): Promise<never> {
  const existing = await gateway.checkout.sessions.retrieve(stripeId).catch(() => null);
  if (existing?.status === "open" && existing.url) redirect(existing.url);
  if (existing?.status === "complete") {
    const paymentIntent = typeof existing.payment_intent === "string" ? existing.payment_intent : null;
    redirect(`/checkout/${orderId}${outcomeQuery(await confirmSessionPaid(orderId, existing.id, paymentIntent, origin))}`);
  }
  // expired session: it can never be paid, and a second one would double-charge a retry loop
  redirect(`/checkout/${orderId}?error=session`);
}

/**
 * Create a Stripe Checkout session (test mode) for an existing order. Prices come from the DB.
 * The order stays `pending` until the webhook confirms payment.
 *
 * One session per order: the row is claimed with a conditional UPDATE before Stripe is called, an
 * open session is reused, and a session that was already paid is confirmed (never charged again).
 */
export async function payAction(fd: FormData) {
  const orderId = String(fd.get("orderId") ?? "");
  if (!orderId) return;
  const gateway = stripe;
  if (!gateway) redirect(`/checkout/${orderId}?error=stripe`);

  const viewer = await currentUser();
  const order = await getOrder(orderId);
  if (!order) redirect("/shop");
  // server actions can be called directly: check permissions here, do not trust the page
  if (!canAccessOrder(viewer, order)) redirect("/shop");
  if (order.paid) redirect(`/checkout/${orderId}`);
  // the hold is over: nothing to pay for, the stock already went back
  if (order.status !== "pending" || order.stockReleased) redirect(`/checkout/${orderId}`);

  const origin = (await headers()).get("origin") ?? `http://${(await headers()).get("host")}`;

  // a paid attempt is confirmed, never re-created
  if (order.stripePaymentIntent) {
    redirect(`/checkout/${order.id}${outcomeQuery(await confirmSessionPaid(order.id, order.stripeId ?? "", order.stripePaymentIntent, origin))}`);
  }
  // a real session is reused; a stale claim is reclaimed below
  if (order.stripeId && !isClaim(order.stripeId)) await redirectToStoredSession(gateway, order.id, order.stripeId, origin);

  const nowSec = Math.floor(Date.now() / 1000);
  const minExpiry = nowSec + STRIPE_MIN_MINUTES * 60;
  let reservedSec = order.reservedUntil ? Math.floor(order.reservedUntil.getTime() / 1000) : 0;

  if (reservedSec < minExpiry) {
    // too little hold left for a legal session: extend it once, bounded by the order age
    const [extended] = await db
      .update(orders)
      .set({ reservedUntil: sql`least(now() + (${SESSION_MINUTES} * interval '1 minute'), ${orders.createdAt} + (${HOLD_CAP_MINUTES} * interval '1 minute'))` })
      .where(
        and(
          eq(orders.id, order.id),
          eq(orders.status, "pending"),
          eq(orders.stockReleased, false),
          sql`${orders.reservedUntil} < now() + (${STRIPE_MIN_MINUTES} * interval '1 minute')`,
          sql`${orders.createdAt} > now() - (${HOLD_CAP_MINUTES} * interval '1 minute')`,
        ),
      )
      .returning({ reservedUntil: orders.reservedUntil });
    if (!extended?.reservedUntil) redirect(`/checkout/${order.id}?error=hold`);
    reservedSec = Math.floor(extended.reservedUntil.getTime() / 1000);
  }

  // the session expiry never passes the hold, so an open session cannot outlive the reservation
  const expiresAt = Math.min(reservedSec, nowSec + SESSION_MINUTES * 60);
  if (expiresAt < minExpiry) redirect(`/checkout/${order.id}?error=hold`);

  // claim: one conditional UPDATE is the lock, so two concurrent clicks cannot both create a session
  const [claimed] = await db
    .update(orders)
    .set({ stripeId: claimKey(order.id) })
    .where(
      and(
        eq(orders.id, order.id),
        eq(orders.status, "pending"),
        eq(orders.stockReleased, false),
        // free, or a claim left behind by a crashed/timed-out attempt
        or(
          isNull(orders.stripeId),
          and(
            like(orders.stripeId, "claim:%"),
            sql`split_part(${orders.stripeId}, ':', 3)::bigint < ${Date.now() - CLAIM_STALE_MS}`,
          ),
        ),
      ),
    )
    .returning({ id: orders.id });

  if (!claimed) {
    const [rival] = await db.select({ stripeId: orders.stripeId }).from(orders).where(eq(orders.id, order.id)).limit(1);
    // the other click is still talking to Stripe: let it finish instead of racing it
    if (!rival?.stripeId) redirect(`/checkout/${order.id}?error=busy`);
    if (isClaim(rival.stripeId) && Date.now() - claimEpoch(rival.stripeId) < CLAIM_STALE_MS) {
      redirect(`/checkout/${order.id}?error=busy`);
    }
    await redirectToStoredSession(gateway, order.id, rival.stripeId, origin);
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await gateway.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        customer_email: order.email,
        line_items: order.items.map((i) => ({
          quantity: i.qty,
          price_data: {
            currency: "usd",
            unit_amount: usdMinor(i.priceMinor), // SAR minor -> cents, matching the displayed price
            product_data: { name: i.title },
          },
        })),
        expires_at: expiresAt,
        success_url: `${origin}/api/stripe/confirm?orderId=${order.id}`,
        cancel_url: `${origin}/checkout/${order.id}?cancel=1`,
      },
      { idempotencyKey: `pay:${order.id}` },
    );
  } catch (e) {
    console.error("stripe session failed:", e instanceof Error ? e.message.slice(0, 120) : e);
    // release the claim, or the order could never be paid again
    await db
      .update(orders)
      .set({ stripeId: null })
      .where(and(eq(orders.id, order.id), like(orders.stripeId, "claim:%")));
    redirect(`/checkout/${order.id}?error=stripe`);
  }

  try {
    await db
      .update(orders)
      .set({
        stripeId: session.id,
        ...(typeof session.payment_intent === "string" ? { stripePaymentIntent: session.payment_intent } : {}),
      })
      .where(and(eq(orders.id, order.id), like(orders.stripeId, "claim:%")));
  } catch (e) {
    // the session exists but the row still holds the claim: clear it so the buyer can retry
    console.error("stripe session persist failed:", e instanceof Error ? e.message.slice(0, 120) : e);
    await db.update(orders).set({ stripeId: null }).where(and(eq(orders.id, order.id), like(orders.stripeId, "claim:%")));
    redirect(`/checkout/${order.id}?error=stripe`);
  }
  redirect(session.url ?? `/checkout/${order.id}`);
}
